const { cloneDeep } = require('lodash');
const atob = require('atob');
const User = require('./user.model').default;
const Client = require('../client/client.model').default;
const Userxp = require('./userxp.model');
const SuperGroupModel = require('../group/superGroup.model').default;
const Puzzle = require('../phase/puzzle/puzzle.model');
const MongoVar = require('../globals/Variables').default;
const UserLiveAssessmentCache = require('../cache/UserLiveAssessment');
const PhaseCache = require('../cache/Phase');
const SubgroupCache = require('../cache/Subgroup');
const UserCache = require('../cache/User');
const lib = require('./lib.js');
const constants = require('../constants.js');
const { uploadAvatarInBackground } = require('./avatar.controller');
const VisitorUser = require('../models/VisitorUser');
const { addAvgData } = require('../assessment/categoryLib');
const { secureGroups } = require('../group/lib.js');
const { getByUserId: getUserAccountByUserId } = require('../cache/UserAccount');
const { isAtLeast } = require('../utils/user/role');

const { secureUser, userTopics, updateReferral } = lib;
const userProjection = {
	username: 1,
	name: 1,
	mobileNumber: 1,
	email: 1,
	isVerified: 1,
	stats: 1, // issue with this!!!
	streak: 1,
	milestones: 1,
	settings: 1,
	dp: 1,
	thumbnail: 1,
	type: 1, // is it required??
	demoStep: 1,
	category: 1, // don't get it here
	currentBatch: 1,
	batchHistory: 1,
	joiningDate: 1,
	children: 1,
	jeeData: 1,
};

function withPhases(user) {
	const user_ = cloneDeep(user.toObject());
	return new Promise((resolve, reject) => {
		UserCache.getWithLiveAssessment(user._id, (err1, user1) => {
			user_.subscriptions = user1.subscriptions;

			// console.log('check user subscriptions', user1.subscriptions);

			user_.liveAssessments = user1.liveAssessments;
			user_.netXp = user1.netXp;

			const ids = [];
			user_.subscriptions.forEach((subscription) => {
				subscription.subgroups.forEach((subgroup) => {
					// console.log('check user subscriptions', subgroup);
					subgroup.phases.forEach((phase) => {
						ids.push(phase.phase);
					});
				});
			});

			PhaseCache.getMany(ids, (err2, phases) => {
				if (err2) {
					reject(err2);
				} else {
					const phasesById = {};
					phases.forEach((phase) => {
						if (phase) {
							phasesById[phase._id] = phase;
						}
					});

					user_.subscriptions.forEach((subscription) => {
						subscription.subgroups.forEach((subgroup) => {
							subgroup.phases.forEach((phase) => {
								phase.phase = phasesById[phase.phase];
							});
						});
					});
					resolve(user_);
				}
			});
		});
	});
}

function getDefaultSubscription(supergroup, subgroup) {
	if (!supergroup) {
		return Promise.resolve({ subscriptions: [] }); // issue with this!
	}
	return SuperGroupModel.findById(supergroup, {
		defaultSubgroup: 1,
		subgroups: 1,
	})
		.populate([
			{
				path: 'defaultSubgroup',
				select: 'phases',
				populate: [{ path: 'phases.phase', select: 'startDate endDate' }],
			},
		])
		.then((searchedSuperGroup) => {
			if (subgroup) {
				let subgroupFound = false;
				searchedSuperGroup.subgroups.forEach((group) => {
					if (group.subgroup.toString() == subgroup) {
						subgroupFound = true;
					}
				});

				if (!subgroupFound) {
					return Promise.resolve({
						error: 'Subgroup not found.',
						searchedSuperGroup,
					});
				}
				return new Promise((resolve) => {
					SubgroupCache.getWithPhases(subgroup, (err, subgroup_) => {
						const phases = [];
						const dateNow = new Date().getTime();
						if (err) {
							//
						} else if (!subgroup_) {
							//
						} else {
							// const isAccessGranted = subgroup_.isPrivate ? false : true;
							subgroup_.phases.forEach((phase) => {
								if (
									dateNow > new Date(phase.phase.startDate).getTime() &&
									dateNow < new Date(phase.phase.endDate).getTime() &&
									phases.length === 0
								) {
									const isAccessGranted = !phase.isPrivate;
									phases.push({
										phase: phase.phase._id,
										active: true,
										isAccessGranted,
									});
								}
							});
						}

						if (!phases.length) {
							resolve({
								error: 'Active phase not found.',
								searchedSuperGroup,
							});
						} else {
							resolve({
								subscriptions: [
									{
										group: supergroup,
										subgroups: [
											{
												group: subgroup,
												phases,
											},
										],
									},
								],
							});
						}
					});
				});
			}
			if (
				!searchedSuperGroup ||
				!searchedSuperGroup.subgroups ||
				!searchedSuperGroup.defaultSubgroup
			) {
				if (searchedSuperGroup && !searchedSuperGroup.defaultSubgroup) {
					return Promise.resolve({
						error: 'Default subgroup not set',
						searchedSuperGroup,
					});
				}
				return Promise.resolve({ error: 'unknown' });
			}

			const phases = [];
			const dateNow = new Date().getTime();

			searchedSuperGroup.defaultSubgroup.phases.forEach((phase) => {
				if (
					dateNow > new Date(phase.phase.startDate).getTime() &&
					dateNow < new Date(phase.phase.endDate).getTime() &&
					phases.length === 0
				) {
					phases.push({
						phase: phase.phase._id,
						active: true,
						isAccessGranted: true,
					});
				}
			});
			return Promise.resolve({
				subscriptions: [
					{
						group: supergroup,
						subgroups: [
							{
								group: searchedSuperGroup.defaultSubgroup._id,
								phases,
							},
						],
					},
				],
			});
		})
		.catch((error) => Promise.resolve({ error: error && error.message }));
}

function createXpDbReferralVisitor(user, referralCode, visitorId, suw) {
	const userxp = new Userxp({
		user: user._id,
		xp: [
			{
				val: constants.xp.signup,
				reference: user._id,
				onModel: 'User',
				description: 'signup',
			},
		],
	});
	userxp.save().then((savedUserXp) => {
		user.netXp = {
			val: constants.xp.signup,
			xp: savedUserXp._id,
		};
		user.markModified('netXp');

		if (!user.dp && process.env.NODE_ENV !== 'development') {
			uploadAvatarInBackground(user);
		} else {
			user.save();
		}
	});
	let referredBy = '';
	if (referralCode) {
		referredBy = atob(referralCode);
	}
	if (referredBy) updateReferral(referredBy, user._id);
	if (visitorId) {
		VisitorUser.findById(visitorId).exec((error, visitor) => {
			if (visitor && !visitor.user) {
				visitor.set('user', user._id);
				visitor.set('convertedBy', 'Sign Up');
				visitor.set('signInWith', suw);
				visitor.save();
			}
		});
	}
}

function validateEmail(email) {
	// eslint-disable-next-line
	const re =
		/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return re.test(String(email).toLowerCase());
}

function getPreparationData(user_, supergroup, role) {
	const showPuzzle = !supergroup || supergroup === '5d10e42744c6e111d0a17d0a';
	return withPhases(user_).then((user) => {
		user.role = role;
		const category = addAvgData(user.category);
		if (user.dp === '') uploadAvatarInBackground(user);
		return new Promise((resolve) => {
			getUserAccountByUserId(user._id, (error, userAccount) => {
				UserLiveAssessmentCache.get(user_._id, (err, userLiveAssessment) => {
					// const userLiveAssessment = {};
					if (!user.subscriptions.length) {
						// no subscriptions!!
						resolve(
							SuperGroupModel.list(true).then((groups) =>
								// eslint-disable-next-line prefer-promise-reject-errors
								Promise.reject({
									success: false,
									error: { code: 'auth/no-subscription' },
									user: secureUser(user),
									groups: secureGroups(groups, user.subscriptions, user.username),
								})
							)
						);
					} else {
						user.liveAssessment = { id: userLiveAssessment.assessmentWrapperId };
						resolve(
							MongoVar.getSupergroupNames().then((supergroupNames) =>
								userTopics(user).then(async (topicData) => {
									if (showPuzzle) {
										return Puzzle.getPuzzleOfTheDay(user._id).then((puzzle) =>
											Promise.resolve({
												user: secureUser(user),
												topics: topicData.topics,
												recommendations: topicData.recommendations,
												// leaderboard: topicData.leaderboard,
												difficulty: topicData.difficulty,
												percentComplete: topicData.percentComplete,
												puzzle,
												supergroupNames,
												category,
												userLiveAssessment,
												userAccount,
											})
										);
									}
									return Promise.resolve({
										user: secureUser(user),
										topics: topicData.topics,
										recommendations: topicData.recommendations,
										// leaderboard: topicData.leaderboard,
										difficulty: topicData.difficulty,
										percentComplete: topicData.percentComplete,
										supergroupNames,
										category,
										userLiveAssessment,
										userAccount,
									});
								})
							)
						);
					}
				});
			});
		});
	});
}

function getPreparationUser(id, supergroup, role) {
	const projection = userProjection;
	const populate = [
		{ path: 'category', select: 'assessments' }, // this is heavy!!
		{ path: 'currentBatch', select: 'name' },
		{ path: 'batchHistory.batch', select: 'name' },
		{
			path: 'children',
			select: 'name email username subscriptions.subgroups.phases.phase',
			populate: {
				path: 'subscriptions.subgroups.phases.phase',
				select: 'name endDate',
			},
		},
	];
	console.log(populate);
	return User.findById(id, projection)
		.populate(populate)
		.then((user_) => {
			console.log(user_);
			if (!user_) {
				return new Promise((resolve) => {
					// delete cookie also here
					resolve({ error: { code: 'auth/invalid-token' } });
				});
			}
			return getPreparationData(user_, supergroup, role);
		})
		.catch((err) => console.log(err));
}

function getAdminData(user_) {
	return withPhases(user_).then((user) =>
		userTopics(user).then((topicData) => {
			if (!isAtLeast('admin', user_.role)) {
				return Promise.resolve({
					user: secureUser(user),
					topics: topicData.topics,
					difficulty: topicData.difficulty,
					puzzles: topicData.puzzles,
				});
			}
			return Client.find({})
				.populate([
					{ path: 'moderators', select: 'email' },
					{ path: 'razorpayAccounts' },
				])
				.then((clients) =>
					Promise.resolve({
						user: secureUser(user),
						topics: topicData.topics,
						difficulty: topicData.difficulty,
						puzzles: topicData.puzzles,
						clients,
					})
				);
		})
	);
}

function getAdminUser(id) {
	const projection = userProjection;
	projection.role = 1;
	projection.subscriptions = 1;
	projection.phases = 1;
	return User.findById(id, projection).then((user) => getAdminData(user));
}

function getMainData(user) {
	return Promise.resolve({ user: secureUser(user) });
}

function getMainUser(id) {
	const projection = userProjection;

	const populate = [
		{ path: 'category' },
		{
			path: 'subscriptions.subgroups.phases.phase',
			select:
				'topicMocks sectionalMocks fullMocks liveTests endDate topics series users',
		},
		{
			path: 'children',
			select: 'name email username subscriptions.subgroups.phases.phase',
			populate: {
				path: 'subscriptions.subgroups.phases.phase',
				select: 'name endDate',
			},
		},
	];
	return User.findById(id, projection)
		.populate(populate)
		.then((user) => Promise.resolve(getMainData(user)));
}

const authFunctions = {
	preparation: getPreparationUser,
	admin: getAdminUser,
	main: getMainUser,
};

const signinFunctions = {
	preparation: getPreparationData,
	admin: getAdminData,
	main: getMainData,
};

module.exports = {
	authFunctions,
	signinFunctions,
	getDefaultSubscription,
	validateEmail,
	createXpDbReferralVisitor,
};
