const Submission = require('../assessment/submission.model').default;
const APIError = require('../helpers/APIError');
const { map } = require('lodash');
const Session = require('../session/session.model').default;
const User = require('../user/user.model').default;
const UserAccount = require('../user/useraccount.model').default;
const Bucket = require('../bucket/bucket.model').default;
const Question = require('../question/question.model').default;
const AssessmentCore = require('../assessment/assessmentCore.model').default;
const Client = require('../client/client.model').default;
const Phase = require('../phase/phase.model').default;
const Attempt = require('../models/Attempt').default;
const SubGroupModel = require('../group/subGroup.model').default;
const VisitorUser = require('../models/VisitorUser');
const Userxp = require('../user/userxp.model');
const Referral = require('../user/referral.model');
const Traction = require('./traction');
const Registration = require('./registration.model');
const { uploadAvatarInBackground } = require('../user/avatar.controller');
const Bot = require('../user/bot.model');
const { ObjectId } = require('mongodb');
const constants = require('../constants.js');
const { getStrippedEmail } = require('../utils/user/email');
const cacheManager = require('../cache/cache-manager');
const { convertArrayToCSV } = require('convert-array-to-csv');
const { isAtLeast } = require('../utils/user/role');

const memoryCache = cacheManager({});

const months = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];

function formatAMPM(date) {
	return `${date.getHours()}:${date.getMinutes()}`;
}

const supergroupShort = {
	'5dd95e8097bc204881be3f2c': 'I',
	'5d10e42744c6e111d0a17d0a': 'P',
	'5d10e43944c6e111d0a17d0c': 'C',
	'5d10e40c44c6e111d0a17d06': 'OJ',
	'5d10e41b44c6e111d0a17d08': 'OJ',
};

function allusers(req, res, next) {
	const {
		payload: { role, id },
		query: { countOnly = false, download = false },
	} = req;
	if (role !== 'super' && role !== 'admin' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	if (role === 'moderator') {
		Client.findOne({ moderators: ObjectId(id) }, { phases: 1 }).then((client) => {
			if (client) {
				User.find(
					{
						role: 'user',
						createdAt: {
							$gte: new Date(new Date().getTime() - 365 * 24 * 3600 * 1000),
						},
						'subscriptions.subgroups.phases.phase': { $in: client.phases },
					},
					{
						dp: 1,
						email: 1,
						createdAt: 1,
						subscriptions: 1,
						username: 1,
						name: 1,
						mobileNumber: 1,
						isVerified: 1,
					}
				)
					.sort({ _id: -1 })
					.populate([
						{ path: 'subscriptions.subgroups.phases.phase', select: 'name' },
					])
					.then((users) => {
						let csv =
							'signup date, email, name, phone, username, phase, suw, isVerified\n';
						users.forEach((user) => {
							let activeGroup = '';
							let activePhase = '';
							// let activeSubgroup = '';
							user.subscriptions.forEach((subscription) => {
								// if (subscription.group === '5d10e42744c6e111d0a17d0a') {
								activeGroup = subscription.group;
								subscription.subgroups.forEach((sg) => {
									sg.phases.forEach((phase) => {
										if (phase.active) {
											activePhase = phase.phase.name;
										}
									});
								});
								// }
							});

							const suw =
								user.dp.indexOf('googleusercontent') !== -1 ? 'Gmail' : 'Email';

							const a = new Date(user.createdAt);
							const cD = `${a.getDate()}/${a.getMonth() + 1}/${a.getFullYear()}`;
							const name = user.name ? user.name.replace(/,/g, ' ') : '';
							const isVerified = user.isVerified ? 'Yes' : 'No';
							csv += `${cD},${user.email},${name},${user.mobileNumber},${user.username},${activePhase},${suw},${isVerified}\n`;
						});
						res.json({ success: true, csv, count: users.length });
					});
			} else {
				res.json({ success: false });
			}
		});
	} else {
		SubGroupModel.find({ supergroup: '5d10e42744c6e111d0a17d0a' }, { name: 1 })
			.then((subgroups) => {
				const subgroupMap = {};
				subgroups.forEach((subgroup) => {
					subgroupMap[subgroup._id.toString()] = subgroup.name.replace(/\,/g, ' ');
				});
				Bot.find({}, { email: 1 })
					.then((bots) => {
						const botemails = bots.map((b) => {
							return b.email;
						});
						if (countOnly) {
							User.count({ email: { $nin: botemails }, role: 'user' })
								.then((count) => {
									res.send({ count });
								})
								.catch((error) => next(new APIError(error, 500, true)));
						} else {
							User.find(
								{
									email: { $nin: botemails },
									role: 'user',
									// createdAt: {
									// 	$gte: new Date(new Date().getTime() - 365 * 24 * 3600 * 1000),
									// },
								},
								{
									dp: 1,
									email: 1,
									createdAt: 1,
									subscriptions: 1,
									username: 1,
									name: 1,
									mobileNumber: 1,
									isVerified: 1,
								}
							)
								.sort({ _id: -1 })
								.populate([
									{ path: 'subscriptions.subgroups.phases.phase', select: 'name' },
								])
								.then((users) => {
									const header = [
										'Sign Up Date (YYYY/MM/DD)',
										'Email',
										'Name',
										'Phone',
										// 'Username',
										'Phase',
										'College',
										'SuperGroup(I: JEE, P: Placement, C: CAT, OJ: Old JEE)',
										'SUW(G: Gmail, E:Gmail)',
										'Is Verified',
									];
									const csvArray = [];
									// let csv =
									// 	'signup date, email, name, phone, username, phase, college, supergroup, suw, isVerified\n';
									users.forEach((user) => {
										let activeGroup = '';
										let activePhase = '';
										let activeSubgroup = '';
										user.subscriptions.forEach((subscription) => {
											// if (subscription.group === '5d10e42744c6e111d0a17d0a') {
											activeGroup = subscription.group;
											subscription.subgroups.forEach((sg) => {
												sg.phases.forEach((phase) => {
													if (phase.active) {
														if (subgroupMap[sg.group]) {
															activeSubgroup = subgroupMap[sg.group];
														}
														activePhase = phase.phase.name;
													}
												});
											});
											// }
										});

										const suw = user.dp.indexOf('googleusercontent') !== -1 ? 'G' : 'E';

										// const a = new Date(user.createdAt);
										// const cD = `${a.getDate()}/${a.getMonth() + 1}/${a.getFullYear()}`;
										// const sg__ = supergroups__[activeGroup]
										// 	? supergroups__[activeGroup]
										// 	: '';
										// const name = user.name ? user.name.replace(/,/g, ' ') : '';
										const isVerified = user.isVerified ? 'Y' : 'N';
										const signUpDate = `${user.createdAt.getYear()}/${user.createdAt.getMonth()}/${user.createdAt.getDate()}`;
										csvArray.push([
											signUpDate,
											user.email,
											user.name,
											user.mobileNumber,
											// user.username,
											activePhase,
											activeSubgroup,
											supergroupShort[activeGroup],
											suw,
											isVerified,
										]);
										// csv += `${cD},${user.email},${name},${user.mobileNumber},${user.username},${activePhase},${activeSubgroup},${sg__},${suw},${isVerified}\n`;
									});
									if (download) {
										res.attachment('allusers.csv');
										res.type('text/csv');
										res.send(convertArrayToCSV(csvArray, { header }));
									} else {
										res.json({
											success: true,
											csv: convertArrayToCSV(csvArray, { header }),
											count: users.length,
										});
									}
								})
								.catch((error) => next(new APIError(error, 500, true)));
						}
					})
					.catch((error) => next(new APIError(error, 500, true)));
			})
			.catch((error) => next(new APIError(error, 500, true)));
	}
}

function placementusers(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super') {
		res.json({ success: false });
		return;
	}

	SubGroupModel.find(
		{ supergroup: '5d10e42744c6e111d0a17d0a' },
		{ name: 1 }
	).then((subgroups) => {
		const subgroupMap = {};
		subgroups.forEach((subgroup) => {
			subgroupMap[subgroup._id.toString()] = subgroup.name.replace(/\,/g, ' ');
		});
		Bot.find({}, { email: 1 }).then((bots) => {
			const botemails = bots.map((b) => {
				return b.email;
			});
			User.find(
				{
					email: { $nin: botemails },
					'subscriptions.group': '5d10e42744c6e111d0a17d0a',
					role: 'user',
					// createdAt: {
					// 	$gte: new Date(new Date().getTime() - 365 * 24 * 3600 * 1000),
					// },
				},
				{
					name: 1,
					email: 1,
					createdAt: 1,
					subscriptions: 1,
					username: 1,
					mobileNumber: 1,
				}
			)
				.sort({ _id: -1 })
				.populate([
					{ path: 'subscriptions.subgroups.phases.phase', select: 'name' },
				])
				.then((users) => {
					let csv = 'signup date, name, email, phone, username, college, phase\n';
					users.forEach((user) => {
						let activeSubgroup = '';
						let activePhase = '';
						user.subscriptions.forEach((subscription) => {
							if (subscription.group === '5d10e42744c6e111d0a17d0a') {
								subscription.subgroups.forEach((sg) => {
									sg.phases.forEach((phase) => {
										if (phase.active) {
											activeSubgroup = subgroupMap[sg.group];
											activePhase = phase.phase.name;
										}
									});
								});
							}
						});

						const a = new Date(user.createdAt);
						const cD = `${a.getDate()}/${a.getMonth() + 1}/${a.getFullYear()}`;
						const name = user.name ? user.name.replace(/,/g, ' ') : '';
						csv += `${cD},${name},${user.email},${user.mobileNumber},${user.username},${activeSubgroup},${activePhase}\n`;
					});
					res.json({ success: true, csv, count: users.length });
				});
		});
	});
}

function catusers(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super') {
		res.json({ success: false });
		return;
	}

	Bot.find({}, { email: 1 }).then((bots) => {
		const botemails = bots.map((b) => {
			return b.email;
		});
		User.find(
			{
				email: { $nin: botemails },
				'subscriptions.group': ObjectId('5d10e43944c6e111d0a17d0c'),
				role: 'user',
			},
			{ email: 1, name: 1 }
		).then((users) => {
			const header = ['email', 'name'];
			const data = map(users, (user) => [user.email, user.name]);
			const csv = convertArrayToCSV(data, {
				header,
			});
			// let csv = 'email,name\n';
			// users.forEach((user) => {
			// 	csv += `${user.email},${user.name}\n`;
			// });
			res.json({ success: true, csv, count: users.length });
		});
	});
}

function placementbutcatusers(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super') {
		res.json({ success: false });
		return;
	}

	Bot.find({}, { email: 1 }).then((bots) => {
		const botemails = bots.map((b) => {
			return b.email;
		});
		User.find(
			{
				email: { $nin: botemails },
				'subscriptions.group': ObjectId('5d10e43944c6e111d0a17d0c'),
				role: 'user',
			},
			{ email: 1 }
		).then((catusers) => {
			const catemails = catusers.map((c) => {
				return c.email;
			});
			botemails.push.apply(botemails, catemails);
			User.find(
				{
					email: { $nin: botemails },
					'subscriptions.group': ObjectId('5d10e42744c6e111d0a17d0a'),
					role: 'user',
				},
				{ email: 1 }
			).then((users) => {
				let csv = 'email\n';
				users.forEach((user) => {
					csv += `${user.email}\n`;
				});
				res.json({ success: true, csv, count: users.length });
			});
		});
	});
}

function createSingleUser(req, res) {
	const {
		body: { user, phase, subgroup },
	} = req;

	SubGroupModel.find(
		{ 'phases.phase': ObjectId(phase), _id: ObjectId(subgroup) },
		{ supergroup: 1 }
	).then(async (subgroups) => {
		// check if phase is active!! and does phase exists? isnt subgroup enough!?
		if (subgroups.length === 1) {
			const subscriptions = [
				{
					group: subgroups[0].supergroup,
					subgroups: [
						{
							group: subgroups[0]._id.toString(),
							phases: [
								{
									phase: ObjectId(phase),
									active: true,
									isAccessGranted: true,
								},
							],
						},
					],
				},
			];

			const strippedEmail = user.email.replace(/(\r\n|\n|\r)/gm, '');
			const strippedPass = user.password.replace(/(\r\n|\n|\r)/gm, '');
			const emailIdentifier = getStrippedEmail(strippedEmail);
			const existingUser = await User.findOne({
				$or: [{ username: user.username }, { emailIdentifier }],
			});
			if (existingUser) {
				res.json({
					success: false,
					error:
						existingUser.emailIdentifier === emailIdentifier
							? 'Email already registered'
							: 'Username already taken',
					user,
				});
				return;
			}

			const finalUser = new User({
				email: strippedEmail,
				emailIdentifier,
				name: user.name,
				mobileNumber: user.mobileNumber,
				milestones: [
					{
						achievement: 'Joined Prepleaf',
						key: '',
						date: new Date(),
					},
				],
				username: user.username,
				settings: {
					sharing: false,
					goal: [{ date: new Date().toString(), goal: 1 }],
				},
				subscriptions,
				isVerified: true,
			});
			finalUser.setPassword(strippedPass);
			finalUser
				.save()
				.then((savedUser) => {
					const userxp = new Userxp({
						user: savedUser._id,
						xp: [
							{
								val: constants.xp.signup,
								reference: savedUser._id,
								onModel: 'User',
								description: 'signup',
							},
						],
					});
					savedUser.netXp = {
						val: constants.xp.signup,
					};
					userxp.save().then((savedUserXp) => {
						savedUser.netXp.xp = savedUserXp._id;
						savedUser.markModified('netXp');

						if (
							process.env.NODE_ENV === 'production' ||
							process.env.NODE_ENV === 'staging'
						) {
							uploadAvatarInBackground(savedUser);
						}

						res.json({ success: true, user });
					});
				})
				.catch((err) => {
					res.json({ success: false, user });
					console.log('check failed id', err);
				});
		} else {
			res.json({ success: false, user });
		}
	});
}

function visitors(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super' && role !== 'admin') {
		res.json({ success: false });
		return;
	}
	VisitorUser.find({})
		.populate([{ path: 'user', select: 'username' }])
		.then((visitors) => {
			let csv = 'date,time,source,convertedBy,signInWith,username\n';
			visitors.forEach((visitor) => {
				const createdAt = `${visitor.createdAt.getDate()} ${
					months[visitor.createdAt.getMonth()]
				},${formatAMPM(visitor.createdAt)}`;
				const username = visitor.user ? visitor.user.username : '';
				const convertedBy = visitor.convertedBy ? visitor.convertedBy : '';
				const signInWith = visitor.signInWith ? visitor.signInWith : '';
				csv += `${createdAt},${visitor.source},${convertedBy},${signInWith},${username}\n`;
			});
			res.json({ success: true, csv, count: visitors.length });
		});
}

async function listSubmissions(req, res, next) {
	const { userId, wrapperId, skip: skipRaw, limit: limitRaw } = req.body;
	const { role } = req.payload;

	const query = {};
	if (userId) {
		query.user = ObjectId(userId);
	} else if (!isAtLeast('admin', role)) {
		next(new APIError('Please select a user', 422, true));
		return;
	}
	if (wrapperId) {
		query.assessmentWrapper = ObjectId(wrapperId);
	}

	const limit = Number.isNaN(parseInt(limitRaw, 10))
		? 10
		: parseInt(limitRaw, 10);
	const skip = Number.isNaN(parseInt(skipRaw, 10)) ? 10 : parseInt(skipRaw, 10);

	try {
		const total = await Submission.countDocuments(query);
		const submissions = await Submission.find(query, {
			assessmentWrapper: 1,
			createdAt: 1,
			sEvent: 1,
			user: 1,
		})
			.sort({ _id: -1 })
			.skip(skip)
			.limit(limit)
			.populate([
				{ path: 'assessmentWrapper', select: 'name _id' },
				{ path: 'user', select: 'name email' },
			])
			.exec();
		res.send({ total, items: submissions });
	} catch (e) {
		next(new APIError(e.message, 422, true));
	}
}

function deleteSubmission(req, res, next) {
	const { id } = req.query;
	Submission.remove({ _id: ObjectId(id) })
		.then((m) => {
			if (m.deletedCount) {
				res.json({ success: true });
			} else {
				next(new APIError('Could not delete submission.'));
			}
		})
		.catch(() => {
			next(new APIError('Could not delete submission.'));
		});
}

function updateUserPhase(userId, phase) {
	return User.findById(userId).then((user) => {
		if (user) {
			if (user.subscriptions.length === 1) {
				return Phase.findById(phase)
					.then((p) => {
						if (p) {
							if (p.supergroup.toString() != user.subscriptions[0].group) {
								return Promise.resolve({
									success: false,
									msg: 'Supergroup mismatch error.',
								});
							}
							if (
								p.subgroups.length === 1 &&
								user.subscriptions[0].subgroups.length === 1
							) {
								// all non placement phases has only one subgroups
								// except target 2020 and not sets.
								user.subscriptions[0].subgroups[0].group =
									p.subgroups[0].subgroup.toString();
								user.subscriptions[0].subgroups[0].phases = [
									{
										active: true,
										phase: p._id,
										isAccessGranted: true,
									},
								];
								user.markModified('subscriptions');
								return new Promise((resolve) => {
									user.save().then(() => {
										clearCache(userId);
										resolve({ success: true });
									});
								});
							}

							// for placement

							const subgroupMap = {};
							p.subgroups.forEach((sg) => {
								subgroupMap[sg.subgroup] = true;
							});

							let subgroupIdx = -1;
							user.subscriptions[0].subgroups.forEach((sg, i) => {
								if (subgroupIdx === -1 && subgroupMap[sg.group]) {
									subgroupIdx = i;
								}
							});
							if (subgroupIdx !== -1) {
								user.subscriptions[0].subgroups[subgroupIdx].phases = [
									{ active: true, phase: p._id, isAccessGranted: true },
								];
								user.markModified('subscriptions');
								return new Promise((resolve) => {
									user.save().then(() => {
										clearCache(userId);
										resolve({ success: true });
									});
								});
							}
							return Promise.resolve({
								success: false,
								msg: 'Subgroup not found in subscription.',
							});
						}
						return Promise.resolve({ success: false, msg: 'Phase not found.' });
					})
					.catch(() => Promise.resolve({ success: false, msg: 'Mongo error' }));
			}
			// this looks most generic.
			// other logics can be discared!! But phase has to be of same subgroup!!! can fix this too.
			return Phase.findById(phase).then((p) => {
				if (p) {
					let supergroupIdx = -1;
					user.subscriptions.forEach((subscription, idx) => {
						if (
							supergroupIdx === -1 &&
							subscription.group == p.supergroup.toString()
						) {
							supergroupIdx = idx;
						}
					});
					if (supergroupIdx === -1) {
						return Promise.resolve({
							success: false,
							msg: 'Subscriptions supergroup did not match.',
						});
					} else {
						const subgroupMap = {};
						p.subgroups.forEach((sg) => {
							subgroupMap[sg.subgroup] = true;
						});

						let subgroupIdx = -1;
						user.subscriptions[supergroupIdx].subgroups.forEach((sg, i) => {
							if (subgroupIdx === -1 && subgroupMap[sg.group]) {
								subgroupIdx = i;
							}
						});
						if (subgroupIdx !== -1) {
							user.subscriptions[supergroupIdx].subgroups[subgroupIdx].phases = [
								{ active: true, phase: p._id, isAccessGranted: true },
							];
							user.markModified('subscriptions');
							return new Promise((resolve, reject) => {
								user.save().then(() => {
									clearCache(userId);
									resolve({ success: true });
								});
							});
						} else {
							/**
							 * if there is just one subgroup in that phase, select that subgroup.
							 * This is will most generic then.
							 * Only thing that will be remaining - take care of Target 2020
							 */
							return Promise.resolve({
								success: false,
								msg: 'Subgroup not found in subscription.',
							});
						}
					}
				} else {
					return Promise.resolve({ success: false, msg: 'Phase not found.' });
				}
			});
		}
		return Promise.resolve({ success: false, msg: 'User not found.' });
	});
	// .catch(() => {
	// 	return Promise.resolve({ success: false, msg: 'Mongo error' });
	// });
}

function updatePhase(req, res) {
	const {
		payload: { role, id },
	} = req;
	if (role !== 'super' && role !== 'admin' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	const { user, phase } = req.body;

	if (role === 'moderator') {
		Client.findOne({ moderators: id, phases: ObjectId(phase) }).then((client) => {
			if (client && client.phases.some((p) => p.equals(phase))) {
				updateUserPhase(user, phase).then((data) => {
					res.json(data);
				});
			} else {
				res.json({ success: false });
			}
		});
	} else {
		updateUserPhase(user, phase).then((data) => {
			res.json(data);
		});
	}
}

function clearCache(id) {
	const key = `u-${id}`;
	memoryCache.del(key, () => {});
}

async function updateEmail(req, res, next) {
	const {
		payload: { role },
	} = req;

	const {
		user: userId,
		email,
		autoSetUsername,
		shouldArchive,
		alsoApplyToSibglings,
	} = req.body;
	const emailIdentifier = getStrippedEmail(email);
	const newUsernameIfAutoSet = `NOTSET_${email}`;
	const { phases } = res.locals;
	const userQuery = {
		_id: userId,
	};
	if (!isAtLeast('admin', role)) {
		userQuery['subscriptions.subgroups.phases.phase'] = { $in: phases };
	}

	try {
		const userWithNewEmail = await User.findOne({
			$or: [{ email }, { emailIdentifier }],
		}).select('_id');
		const userAccountWithNewEmail = await UserAccount.findOne({
			$or: [{ email }, { emailIdentifier }],
		}).select('_id');
		if (userWithNewEmail || userAccountWithNewEmail) {
			throw new Error(
				`${
					userWithNewEmail ? 'User' : 'User Account'
				} already exists with this email`
			);
		}
		if (autoSetUsername) {
			const userWithUsername = await User.findOne({
				username: newUsernameIfAutoSet,
			});
			const userAccountWithNewUsername = await UserAccount.findOne({
				username: newUsernameIfAutoSet,
			}).select('_id');

			if (userWithUsername || userAccountWithNewUsername) {
				throw new Error(
					`${
						userWithUsername ? 'User' : 'User Account'
					} already exists with this username`
				);
			}
		}

		const user = await User.findOne(userQuery);
		if (!user) {
			throw new Error(
				'Either user does not exists or you do not have required permissions'
			);
		}
		const userAccount = await UserAccount.findOne({ users: { $in: user._id } });
		if (userAccount) {
			if (userAccount.users.length > 1) {
				// multiple users for user account case
				if (alsoApplyToSibglings) {
					const allSiblingQuery = {
						...userQuery,
						_id: userAccount.users,
					};
					const numberOfUsersAdminHasPermission = await User.countDocuments(
						allSiblingQuery
					);
					if (numberOfUsersAdminHasPermission !== userAccount.users.length) {
						next(
							new APIError(
								'You do not have permission to update/archive this user account. Instead try update/archive only this user.',
								422,
								true
							)
						);
					} else {
						const userUpdateQuery = {
							email,
							emailIdentifier,
						};
						userAccount.email = email;
						userAccount.emailIdentifier = emailIdentifier;
						[userAccount.defaultUser] = userAccount.users.filter(
							(uId) => !uId.equals(userId)
						);
						if (autoSetUsername) {
							userUpdateQuery.username = newUsernameIfAutoSet;
						}
						if (shouldArchive) {
							userUpdateQuery.isArchived = true;
							userUpdateQuery.subscriptions = [];
							userAccount.isArchived = true;
						}
						await User.updateMany(allSiblingQuery, { $set: { userUpdateQuery } });
						await userAccount.save();
						res.send({
							message: 'User and all its siblings updated/archived',
							success: true,
						});
					}
				} else {
					// only archive current user
					user.email = email;
					user.emailIdentifier = emailIdentifier;
					if (autoSetUsername) {
						user.username = newUsernameIfAutoSet;
					}
					if (shouldArchive) {
						user.isArchived = true;
						user.subscriptions = [];
					}
					await user.save();
					userAccount.users = userAccount.users.filter((u) => !u.equals(user._id));
					await userAccount.save();
					res.send({
						success: true,
						message: 'User updated/archived and unlinked from user account',
					});
				}
			} else {
				// single user, also archive user account
				user.email = email;
				user.emailIdentifier = emailIdentifier;
				if (autoSetUsername) {
					user.username = newUsernameIfAutoSet;
				}
				if (shouldArchive) {
					user.isArchived = true;
					user.subscriptions = [];
				}
				await user.save();
				userAccount.email = email;
				userAccount.emailIdentifier = emailIdentifier;
				userAccount.isArchived = true;
				userAccount.save();
				res.send({
					success: true,
					message: 'User and user account updated/archived',
				});
			}
		} else {
			user.email = email;
			user.emailIdentifier = emailIdentifier;
			if (autoSetUsername) {
				user.username = newUsernameIfAutoSet;
			}
			if (shouldArchive) {
				user.isArchived = true;
				user.subscriptions = [];
			}
			await user.save();
			res.send({
				success: true,
				message: 'Email updated/archived successfully.',
			});
		}
	} catch (e) {
		next(new APIError(e.message, 422, true));
	}
}

function updateUsername(req, res) {
	const {
		payload: { role, id },
	} = req;
	if (role !== 'super' && role !== 'admin' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	const { user, username } = req.body;

	if (role === 'moderator') {
		Client.findOne({ moderators: ObjectId(id) }, { phases: 1 }).then((client) => {
			if (client) {
				User.findOne({
					username,
				}).then((u1) => {
					if (u1) {
						res.json({ success: false, msg: 'Username already exists.' });
					} else {
						User.update(
							{
								_id: ObjectId(user),
								'subscriptions.subgroups.phases.phase': { $in: client.phases },
							},
							{ $set: { username } }
						)
							.then((m) => {
								if (m.nModified === 1) {
									clearCache(user);
									res.json({ success: true });
								} else {
									res.json({ success: false, msg: 'User not updated.' });
								}
							})
							.catch(() => {
								res.json({
									success: false,
									msg: 'Something wrong while updating user.',
								});
							});
					}
				});
			} else {
				res.json({ success: false, msg: 'Client not found.' });
			}
		});
	} else {
		User.findOne({ username }).then((u1) => {
			if (u1) {
				res.json({ success: false, msg: 'Username already exists.' });
			} else {
				User.update({ _id: ObjectId(user) }, { $set: { username } })
					.then((m) => {
						// remove cache!!
						if (m.nModified === 1) {
							clearCache(user);
							res.json({ success: true });
						} else {
							res.json({ success: false, msg: 'User not updated.' });
						}
					})
					.catch(() => {
						res.json({ success: false, msg: 'Something wrong while updating user.' });
					});
			}
		});
	}
}

function fixreferrals(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super') {
		res.json({ success: false });
		return;
	}
	Referral.find({})
		.then((referrals) => {
			referrals.forEach((r) => {
				User.findOne({ username: r.referrerUsername }, { _id: 1 }).then((u1) => {
					User.findById(r.referred, { _id: 1 }).then((u2) => {
						if (!r.referrer) {
							r.referrer = u1._id;
							r.referredUser = u2._id;
							r.medium = 'LINK';
							r.status = 'COMPLETE';
							r.createdAt = r._id.getTimestamp();
							r.markModified('referrer');
							r.markModified('referredUser');
							r.markModified('medium');
							r.markModified('status');
							r.markModified('createdAt');
							r.save().then(() => {
								console.log('done!');
							});
						}
					});
				});
			});
			res.json({ success: true, referrals });
		})
		.catch(() => {
			res.json({ success: false });
		});
}

function getreferrals(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super') {
		res.json({ success: false });
		return;
	}
	Referral.find({})
		.populate([
			{
				path: 'referrer',
				select: 'email subscriptions',
				populate: [
					{ path: 'subscriptions.subgroups.phases.phase', select: 'name' },
				],
			},
			{ path: 'referredUser', select: 'email' },
		])
		.then((referrals) => {
			res.json({ success: true, referrals });
		})
		.catch(() => {
			res.json({ success: false });
		});
}

function getUserLabel(sessions, submissions) {
	let label = 'SIGNUP';
	if (sessions.length || submissions.length) {
		label = 'TESTER';
	}

	const seriousAttempts = [];
	sessions.forEach((session) => {
		if (
			session.questions.length >= 3 &&
			new Date(session.endTime).getTime() >
				new Date(session.startTime).getTime() + 5 * 60 * 1000
		) {
			seriousAttempts.push({ time: session.startTime });
		}
	});

	submissions.forEach((submission) => {
		let totalTime = 0;
		submission.response.sections.forEach((section) => {
			section.questions.forEach((question) => {
				totalTime += question.time; // in msec
			});
		});
		if (
			submission.assessmentCore &&
			totalTime > 0.5 * submission.assessmentCore.duration * 1000
		) {
			// if user spend atleast half of the time
			seriousAttempts.push({ time: submission.createdAt });
		}
	});

	if (seriousAttempts.length) {
		label = 'SERIOUS';
	}

	let minTime = null;
	let maxTime = null;

	seriousAttempts.forEach((sa) => {
		const t = new Date(sa.time).getTime();
		if (minTime === null || t < minTime) {
			minTime = t;
		}
		if (maxTime === null || t > maxTime) {
			maxTime = t;
		}
	});

	if (
		minTime !== null &&
		maxTime !== null &&
		maxTime > minTime + 24 * 60 * 60 * 1000
	) {
		label = 'COMMITTED';
	}

	return label;
}

const refDate = new Date('2019-07-29T00:00:00Z'); //first week of august

function fixtraction(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super') {
		res.json({ success: false });
		return;
	}

	const tn = new Date(new Date() - 7 * 24 * 60 * 60 * 1000);

	User.find({
		$or: [
			{ label: '' },
			{ labelUpdate: { $exists: false } },
			{ labelUpdate: { $lte: tn } },
		],
	})
		.limit(500)
		.then((users) => {
			users.forEach((user) => {
				Session.find(
					{ user: user._id, hasEnded: true },
					{ questions: 1, startTime: 1, endTime: 1 }
				).then((sessions) => {
					Submission.find(
						{ user: user._id },
						{ 'response.sections.questions.time': 1, createdAt: 1, assessmentCore: 1 }
					)
						.populate([{ path: 'assessmentCore', select: 'duration' }])
						.then((submissions) => {
							const label = getUserLabel(sessions, submissions);
							const week =
								1 +
								Math.floor(
									(new Date(user.createdAt).getTime() - refDate.getTime()) /
										(7 * 24 * 60 * 60 * 1000)
								);

							const query = {};
							if (label === 'SIGNUP') {
								query.$addToSet = { signups: user._id };
								query.$pull = {
									l1Users: user._id,
									l2Users: user._id,
									l3Users: user._id,
								};
								// addToSet signup | pull from l1, l2 and l3
							} else if (label === 'TESTER') {
								query.$addToSet = { signups: user._id, l1Users: user._id };
								query.$pull = {
									l2Users: user._id,
									l3Users: user._id,
								};
								// addToSet signup, l1 | pull from l2 and l3
							} else if (label === 'SERIOUS') {
								query.$addToSet = {
									signups: user._id,
									l1Users: user._id,
									l2Users: user._id,
								};
								query.$pull = {
									l3Users: user._id,
								};
								// addToSet signup, l1, l2 | pull from l3
							} else if (label === 'COMMITTED') {
								query.$addToSet = {
									signups: user._id,
									l1Users: user._id,
									l2Users: user._id,
									l3Users: user._id,
								};
								// addToSet signup, l1, l2, l3
							}

							let phase = '';
							user.subscriptions.forEach((subscription) => {
								subscription.subgroups.forEach((subgroup) => {
									subgroup.phases.forEach((ph) => {
										if (phase === '' && ph.phase) {
											phase = ph.phase;
										}
									});
								});
							});

							if (phase) {
								Traction.findOne({ phase, week }).then((traction) => {
									if (traction) {
										// console.log('traction found, updating ...', traction, query);
										Traction.update({ _id: traction._id }, query).then(() => {
											User.update(
												{ _id: user._id },
												{ $set: { label, labelUpdate: new Date() } }
											).exec();
										});
									} else {
										// console.log('traction not found, updating ...');

										const traction_ = new Traction({
											phase,
											week,
											signups: [],
											l1Users: [],
											l2Users: [],
											l3Users: [],
										});
										traction_
											.save()
											.then((savedTraction) => {
												Traction.update({ _id: savedTraction._id }, query).then(() => {
													User.update(
														{ _id: user._id },
														{ $set: { label, labelUpdate: new Date() } }
													).exec();
												});
											})
											.catch((err) => {
												console.log('error', err);
											});
									}
								});
							} else {
								User.update(
									{ _id: user._id },
									{ $set: { label: 'INCOMPLETE-SIGNUP', labelUpdate: new Date() } }
								).exec();
							}

							// console.log('check label', label, user.email, week, phase);
						});
				});
			});
			res.json({ success: true, users });
		});
}

function gettractions(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super') {
		res.json({ success: false });
		return;
	}
	Traction.find({})
		.populate([
			{ path: 'phase', select: '_id name' },
			{ path: 'signups', select: 'email createdAt _id' },
		])
		.then((tractions) => {
			res.json({ success: true, tractions });
		})
		.catch(() => {
			res.json({ success: false });
		});
}

function migrateQuestions(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super') {
		res.json({ success: false });
		return;
	}

	AssessmentCore.find(
		{ version: { $ne: 1 } },
		{ _id: 1, version: 1, sections: 1 }
	)
		.limit(10)
		.then((assessmentCores) => {
			assessmentCores.forEach((assessmentCore) => {
				assessmentCore.sections.forEach((section) => {
					section.questions.forEach((question) => {
						Question.update(
							{ _id: question.question },
							{ $addToSet: { usedIn: assessmentCore._id } }
						).exec();
					});
				});
				assessmentCore.version = 1;
				assessmentCore.markModified('version');
				assessmentCore.save().then(() => {
					//
				});
			});
			const ids = assessmentCores.map((ac) => {
				return ac._id;
			});
			res.json({ success: true, ids });
		});
}

function updateIncorrectQuestion(question, userId, date) {
	const incorrectQuestions = [];
	const correctQuestions = [];

	// console.log('updating incorrectQuestions!!!', userId);

	Bucket.findOne({ user: ObjectId(userId) }).then((bucket) => {
		if (bucket) {
			let found = -1;
			bucket.buckets.forEach((b, idx) => {
				if (b.name === 'Incorrect' && b.default) {
					found = idx;
				}
			});
			if (found === -1) {
				const k = {};
				k['bookmarkedAtByQuestionId.' + question] = date;
				Bucket.update(
					{ user: ObjectId(userId) },
					{
						$push: {
							buckets: {
								name: 'Incorrect',
								color: '#ee4c48',
								default: true,
								questions: incorrectQuestions,
							},
						},
						$set: k,
					}
				).exec();
			} else {
				const query = {};
				query['buckets.' + found + '.questions'] = ObjectId(question);
				const k = {};
				k['bookmarkedAtByQuestionId.' + question] = date;
				Bucket.update(
					{ user: ObjectId(userId) },
					{ $addToSet: query, $set: k }
				).exec();
			}
		} else {
			// do nothing
		}
	});
}

function updateOvertimeQuestion(question, userId, date) {
	const incorrectQuestions = [];
	const correctQuestions = [];

	// console.log('updating overtimeQuestions!!!', userId);

	Bucket.findOne({ user: ObjectId(userId) }).then((bucket) => {
		if (bucket) {
			let found = -1;
			bucket.buckets.forEach((b, idx) => {
				if (b.name === 'Overtime' && b.default) {
					found = idx;
				}
			});
			if (found === -1) {
				const k = {};
				k['bookmarkedAtByQuestionId.' + question] = date;
				Bucket.update(
					{ user: ObjectId(userId) },
					{
						$push: {
							buckets: {
								name: 'Overtime',
								color: '#f4ce56',
								default: true,
								questions: [question],
							},
						},
						$set: k,
					}
				).exec();
			} else {
				const query = {};
				query['buckets.' + found + '.questions'] = ObjectId(question);
				const k = {};
				k['bookmarkedAtByQuestionId.' + question] = date;
				Bucket.update(
					{ user: ObjectId(userId) },
					{ $addToSet: query, $set: k }
				).exec();
			}
		} else {
			// do nothing
		}
	});
}

function migrateBookmarks(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super') {
		res.json({ success: false });
		return;
	}

	let ti = 0;
	let total = 0;
	const timer = setInterval(() => {
		if (ti < 10) {
			Attempt.find({
				version: { $ne: 2 },
				time: { $gt: 0 },
				onModel: 'AssessmentWrapper',
			})
				.limit(1000)
				.populate([
					{
						path: 'question',
						select: 'statistics',
						populate: [{ path: 'statistics', select: 'perfectTimeLimits' }],
					},
				])
				.then((attempts) => {
					attempts.forEach((attempt) => {
						//
						if (!attempt.isCorrect) {
							updateIncorrectQuestion(
								attempt.question._id,
								attempt.user,
								attempt._id.getTimestamp()
							);
							// add to incorrect
						}
						if (attempt.time > attempt.question.statistics.perfectTimeLimits.max) {
							updateOvertimeQuestion(
								attempt.question._id,
								attempt.user,
								attempt._id.getTimestamp()
							);
							// add to overtime
						}
						//
					});
					const ids = attempts.map((u) => {
						return u._id;
					});
					total += ids.length;
					ti += 1;
					Attempt.updateMany({ _id: { $in: ids } }, { $set: { version: 2 } })
						.exec()
						.then(() => {});
				});
		} else {
			res.json({ success: true, c: total });
			clearInterval(timer);
		}
	}, 2500);
}

function createBuckets(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super') {
		res.json({ success: false });
		return;
	}

	User.find({ version: { $ne: 99 } }, { bookmarks: 1 })
		.limit(500)
		.then((users) => {
			users.forEach((user) => {
				Bucket.findOne({ user: user._id }).then((bucket) => {
					if (bucket) {
						// do nothing
					} else {
						const bookmarkedAtByQuestionId = {};
						const qids = user.bookmarks.map((bookmark) => {
							bookmarkedAtByQuestionId[bookmark.qid] = bookmark.date;
							return ObjectId(bookmark.qid);
						});
						const bucket_ = new Bucket({
							user: ObjectId(user._id),
							buckets: [
								{
									name: 'Incorrect',
									color: '#ee4c48',
									default: true,
									questions: [],
								},
								{
									name: 'Overtime',
									color: '#f4ce56',
									default: true,
									questions: [],
								},
								{
									name: 'Following',
									color: '#f4a451',
									default: true,
									questions: qids,
								},
							],
							bookmarkedAtByQuestionId,
						});
						bucket_.save().then((savedBucket) => {
							// console.log('bucket created\n');
							// res.json({ success: true });
						});
					}
				});
			});
			const ids = users.map((u) => {
				return u._id;
			});
			User.updateMany({ _id: { $in: ids } }, { $set: { version: 99 } })
				.exec()
				.then(() => {
					res.json({ success: true, c: users.length });
				});
		});
	// .catch(() => {
	// 	res.json({ success: false });
	// });
}

function addRegistration(req, res) {
	const { data } = req.body;
	if (data) {
		const r = new Registration({
			data,
		});
		r.save().then(() => {
			res.json({ success: true });
		});
	} else {
		res.json({ success: false });
	}
}

module.exports = {
	allusers,
	placementusers,
	catusers,
	placementbutcatusers,
	createSingleUser,
	visitors,
	listSubmissions,
	deleteSubmission,
	updatePhase,
	updateEmail,
	updateUsername,
	fixreferrals,
	getreferrals,
	fixtraction,
	gettractions,
	migrateQuestions,
	migrateBookmarks,
	createBuckets,
	addRegistration,
};
