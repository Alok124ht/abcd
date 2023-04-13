const mongoose = require('mongoose');
const { forEach, get, has, map, size } = require('lodash');
const async = require('async');
const crypto = require('crypto');
const querystring = require('querystring');
const UserAccount = require('./useraccount.model').default;
const AssessmentCore = require('../assessment/assessmentCore.model').default;
const AssessmentWrapper = require('../assessment/assessmentWrapper.model')
	.default;
const Token = require('../token/token.model').default;
const APIError = require('../helpers/APIError');
const User = require('./user.model').default;
const Client = require('../client/client.model').default;
const cacheManager = require('../cache/cache-manager');
const Userxp = require('./userxp.model');
const { getStrippedEmail } = require('../utils/user/email');
const SubmissionModel = require('../assessment/submission.model').default;
const { getMaxMarks } = require('../lib');

const { ObjectId } = mongoose.Types;
const memoryCache = cacheManager({});

const rewardXPToUsers = (req, res) => {
	const {
		limit: rawLimit,
		filters: rawFilters,
		rewardValue: rawRewardValue,
		description,
		rewardSize,
		campaignName,
	} = req.body;
	try {
		const limit = parseInt(rawLimit, 10);
		const rewardValue = parseInt(rawRewardValue, 10);
		const filters = JSON.parse(rawFilters);
		if (['normal', 'bigreward'].indexOf(rewardSize) === -1) {
			throw new Error('rewardSize is required');
		}
		if (rewardValue > 1000 && rewardSize !== 'bigreward') {
			throw new Error('Reward can not be greater than 1000');
		}
		if (typeof rewardValue !== 'number' || Number.isNaN(rewardValue)) {
			throw new Error('rewardValue must be a number');
		}
		if (!description || !description.length) {
			throw new Error('Description is required');
		}
		if (Number.isNaN(limit)) {
			throw new Error('Limit must be a number');
		}
		Userxp.find({ ...filters, 'xp.campaignName': { $ne: campaignName } })
			.limit(limit)
			.exec((searchError, docs) => {
				if (searchError) {
					res.status(500).send({ message: searchError.message });
				} else {
					let callbackCount = -1;
					const errors = [];
					const respondOnCompletion = (error) => {
						callbackCount += 1;
						if (error) {
							errors.push(error);
						}
						if (callbackCount === docs.length) {
							res.send({
								errors,
								shouldReward: docs.length,
								rewarded: docs.length - errors.length,
							});
						}
					};
					respondOnCompletion();
					docs.forEach((doc) => {
						doc.xp.push({
							val: rewardValue,
							onModel: 'User',
							reference: doc.user,
							description,
							campaignName,
						});
						doc.save((e) => {
							if (e) {
								respondOnCompletion({
									message: `Failed to save Userxp._id ${doc._id}, userId: ${doc.user}`,
									e: e.message,
								});
							} else {
								respondOnCompletion();
							}
						});
					});
				}
			});
	} catch (e) {
		res
			.status(500)
			.send({ message: 'Some error occurred', sp: e.message, rawFilters });
	}
};

const clearCache = (req, res) => {
	const { key } = req.query;
	memoryCache.del(key, (err, count) => {
		if (err) {
			res.status(422).send({ message: err.message });
		} else {
			res.send({ message: 'Cleared', count });
		}
	});
};

async function downloadUserMarksData(req, res, next) {
	const { userIds } = req.body;
	SubmissionModel.find({ user: { $in: userIds } }).exec(
		async (searchError, submissions) => {
			if (searchError) {
				next(new APIError(searchError));
				return;
			}
			const allCoreIds = [];
			const allWrapperIds = [];
			submissions.forEach((submission) => {
				allCoreIds.push(submission.assessmentCore);
				allWrapperIds.push(submission.assessmentWrapper);
			});
			const allCores = await AssessmentCore.find({ _id: { $in: allCoreIds } });
			const allWrappers = await AssessmentWrapper.find({
				_id: { $in: allWrapperIds },
			})
				.select('type')
				.exec();
			const wrappersById = {};
			const coresById = {};
			allWrappers.forEach((wrapper) => {
				wrappersById[wrapper._id] = wrapper;
			});
			allCores.forEach((core) => {
				coresById[core._id] = { maxMarks: getMaxMarks(core) };
			});
			const dataByUserIds = {};
			userIds.forEach((userId) => {
				dataByUserIds[userId] = {
					maxMarks: 0,
					marksScored: 0,
					userId,
				};
			});
			submissions
				.filter((submission) => {
					const wrapper = wrappersById[submission.assessmentWrapper];
					if (!wrapper) {
						return false;
					}
					return wrapper.type === 'LIVE-TEST';
				})
				.forEach((mongooseSubmission) => {
					const submission = mongooseSubmission.toObject();
					const assessmentCore = coresById[submission.assessmentCore];
					if (!assessmentCore) {
						return;
					}
					const { maxMarks } = assessmentCore;
					if (maxMarks && has(submission, ['meta', 'marks'])) {
						dataByUserIds[submission.user].marksScored += get(
							submission,
							['meta', 'marks'],
							0
						);
						dataByUserIds[submission.user].maxMarks += maxMarks;
					}
				});
			const items = [];
			forEach(dataByUserIds, (dataOfUser) => {
				items.push(dataOfUser);
			});
			res.send({ items });
		}
	);
}

const getRandomString = (length) => {
	const seed = 'abcdefghijklmnopqrstxyz';
	let finalString = '';
	for (let i = 0; i < length; i += 1) {
		const charIndex = Math.floor(Math.random() * (seed.length - 1));
		finalString += seed[charIndex];
	}
	return finalString;
};

const archiveUser = (req, res) => {
	const { user } = req.query;
	User.findById(user).then((user1) => {
		if (user1) {
			if (user1.archiveRequest) {
				const ar = new Date(user1.archiveRequest).getTime();
				const tn = new Date().getTime();
				if (tn < ar + 1.25 * 60 * 1000 && tn > ar + 1 * 60 * 1000) {
					// within 1 min and 1 min 15 secs only
					const rn = Math.round(Math.random() * 100);
					const prefix = getRandomString(10);
					const newEmail = `${prefix}${user1.email}_${rn}`;
					const newUsername = `NOTSET_${newEmail}`;
					const newEmailIdentifier = getStrippedEmail(newEmail);
					User.findOne({
						email: newEmail,
						emailIdentifier: newEmailIdentifier,
						username: newUsername,
					}).then((user2) => {
						if (user2) {
							res.json({
								success: false,
								message: 'Please try again. Randomization error.',
							});
						} else {
							User.update(
								{ _id: user1._id },
								{
									$set: {
										email: newEmail,
										emailIdentifier: newEmailIdentifier,
										username: newUsername,
									},
								}
							)
								.exec()
								.then(async () => {
									const userAccount = await UserAccount.findOne({ users: user1._id });
									if (userAccount && userAccount.users.length > 1) {
										// unlink from userAccount only if there are multiple users
										userAccount.users = userAccount.users.filter(
											(uId) => !uId.equals(user1._id)
										);
									}
									res.json({
										success: true,
										message: `New email of user is ${newEmail}`,
									});
								});
						}
					});
				} else {
					User.update({ _id: user1._id }, { $set: { archiveRequest: '' } })
						.exec()
						.then(() => {
							res.json({
								success: false,
								message: 'Not in time. Reseting archive request.',
							});
						});
				}
			} else {
				User.update({ _id: user1._id }, { $set: { archiveRequest: new Date() } })
					.exec()
					.then(() => {
						res.json({
							success: true,
							message: 'Archive Request Sent. You just need to do the next step!.',
						});
					});
			}
		} else {
			res.json({ success: false, message: 'User not found.' });
		}
	});
};

const getPasswordResetLink = (req, res, next) => {
	const { role, id } = req.payload;

	if (role === 'moderator') {
		Client.findOne({ moderators: id }, { phases: 1 }).then((client) => {
			if (client) {
				const { user } = req.query;

				async.waterfall(
					[
						(done) => {
							crypto.randomBytes(20, (err, buf) => {
								const token = buf.toString('hex');
								done(err, token);
							});
						},
						(token, done) => {
							let selector = {};
							const operator = {};
							selector = {
								resetPasswordToken: token,
								resetPasswordExpires: Date.now() + 3600000,
							};
							operator.$set = selector;
							User.update(
								{
									_id: ObjectId(user),
									'subscriptions.subgroups.phases.phase': { $in: client.phases },
								},
								operator
							).then((q) => {
								if (q.nModified === 1) {
									done(null, token);
								} else {
									res.status(422).json({
										error: { code: 'invalid-email' },
									});
								}
							});
						},
						(token) => {
							const resetLinkBaseUrl = `${process.env.UI_BASE_HOST}/reset`;
							const queryString = querystring.stringify({
								token,
								r: process.env.UI_BASE_HOST,
							});
							const resetLink = `${resetLinkBaseUrl}?${queryString}`;
							res.json({ success: true, resetLink });
						},
					],
					(err) => {
						if (err) {
							next(err);
						}
					}
				);
			} else {
				res.json({ success: false });
			}
		});
	} else {
		const { user } = req.query;

		async.waterfall(
			[
				(done) => {
					crypto.randomBytes(20, (err, buf) => {
						const token = buf.toString('hex');
						done(err, token);
					});
				},
				(token, done) => {
					let selector = {};
					const operator = {};
					selector = {
						resetPasswordToken: token,
						resetPasswordExpires: Date.now() + 3600000,
					};
					operator.$set = selector;
					User.update({ _id: ObjectId(user) }, operator).then((q) => {
						if (q.nModified === 1) {
							done(null, token);
						} else {
							res.status(422).json({
								error: { code: 'invalid-email' },
							});
						}
					});
				},
				(token) => {
					const resetLinkBaseUrl = `${process.env.UI_BASE_HOST}/reset`;
					const queryString = querystring.stringify({
						token,
						r: process.env.UI_BASE_HOST,
					});
					const resetLink = `${resetLinkBaseUrl}?${queryString}`;
					res.json({ success: true, resetLink });
				},
			],
			(err) => {
				if (err) {
					next(err);
				}
			}
		);
	}
};

const getTokensForUser = (req, res, next) => {
	const { user: userId } = req.query;
	const { userIds } = req.body;
	const tokenQuery = {};
	if (Array.isArray(userIds)) {
		tokenQuery.user = userIds;
	} else {
		tokenQuery.user = userId;
	}
	Token.find(tokenQuery)
		.select(
			'isBlacklisted userAgent logoutUserAgent createdAt updatedAt ip logoutIp'
		)
		.exec((error, tokens) => {
			if (error) {
				next(new APIError('', 500));
			} else {
				res.send({ tokens });
			}
		});
};

const getUserAccountAnomalies = (req, res) => {
	UserAccount.find({})
		.select('users emailIdentifier')
		.then((accounts) => {
			const accountsByUserId = {};
			forEach(accounts, (account) => {
				forEach(account.users, (userId) => {
					if (!accountsByUserId[userId]) {
						accountsByUserId[userId] = [];
					}
					accountsByUserId[userId].push(account);
				});
			});
			const anomalies = [];
			forEach(accountsByUserId, (userAccounts, userId) => {
				if (size(userAccounts) > 1) {
					anomalies.push({ userId, userAccounts });
				}
			});
			User.find({ _id: { $nin: Object.keys(accountsByUserId) } })
				.select('_id')
				.then((users) => {
					const incorrectLinkedUsersQuery = { $or: [] };
					forEach(accounts, (account) => {
						forEach(account.users, (userId) => {
							incorrectLinkedUsersQuery.$or.push({
								emailIdentifier: { $ne: account.emailIdentifier },
								_id: userId,
							});
						});
					});
					User.find(incorrectLinkedUsersQuery)
						.select('emailIdentifier email')
						.then((incorrectlyLinkedUsers) => {
							res.send({
								anomalies,
								usersNotMigratedCount: size(users),
								accountsCount: size(accounts),
								userIdsMigrated: accountsByUserId[Object.keys(accountsByUserId)[0]],
								usersNotMigrated: size(users),
								incorrectlyLinkedUsers: map(incorrectlyLinkedUsers, (u) => ({
									ua: map(accountsByUserId[u._id], (account) =>
										get(account, ['emailIdentifier'])
									),
									...u.toObject(),
								})),
								notMigratedUser: users[0],
							});
						});
				})
				.catch(() => {
					res.send({ anomalies, message: 'Error searching users not migrated' });
				});
		})
		.catch((error) => {
			res.send({ error });
		});
};

const markEmailsAsVerified = (req, res, next) => {
	const { users: userIds } = req.body;
	const { phases } = res.locals;
	User.updateMany(
		{
			_id: { $in: userIds },
			'subscriptions.subgroups.phases.phase': { $in: phases },
			isVerified: false,
		},
		{ $set: { isVerified: true, verifiedBy: 'Admin' } }
	)
		.then((result) => {
			res.send({ result });
		})
		.catch((error) => next(new APIError(error, 500)));
};

const updateUserBatchBulk = async (req, res) => {
	const { items } = req.body;
	const { phases } = res.locals;
	const userIdsToUpdate = {};
	const users = await User.find({
		$and: [
			{ 'subscriptions.subgroups.phases.phase': { $in: phases } },
			{
				$or: map(items, (item) => ({
					_id: item.userId,
					currentBatch: { $ne: item.batchId },
				})),
			},
		],
	}).select('subscriptions subscriptions currentBatch batchHistory');
	forEach(users, (user) => {
		userIdsToUpdate[user._id] = true;
	});
	const groupsByNewBatchId = {};
	forEach(items, (item) => {
		if (userIdsToUpdate[item.userId]) {
			if (!groupsByNewBatchId[item.batchId]) {
				groupsByNewBatchId[item.batchId] = [];
			}
			groupsByNewBatchId[item.batchId].push(item.userId);
		}
	});
	const result = await Promise.all(
		map(
			groupsByNewBatchId,
			(userIds, batchId) =>
				new Promise((resolve) => {
					User.updateMany(
						{ _id: { $in: userIds } },
						{
							$set: { currentBatch: batchId },
							$push: { batchHistory: { batch: ObjectId(batchId) } },
						}
					)
						.then((v) => {
							resolve(v);
						})
						.catch((error) => {
							resolve(error.message);
						});
				})
		)
	);

	res.send({ result, groupsByNewBatchId, items, users, userIdsToUpdate });
};

module.exports = {
	rewardXPToUsers,
	clearCache,
	archiveUser,
	getPasswordResetLink,
	getTokensForUser,
	getUserAccountAnomalies,
	markEmailsAsVerified,
	downloadUserMarksData,
	updateUserBatchBulk,
};
