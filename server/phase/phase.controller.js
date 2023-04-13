const { ObjectId } = require('mongodb');
const { get, includes, isEmpty, some, forEach, reverse } = require('lodash');
const { convertArrayToCSV } = require('convert-array-to-csv');
const Phase = require('./phase.model').default;
const UEReport = require('./uereport');
const UserCache = require('../cache/User');
const SuperGroupModel = require('../group/superGroup.model').default;
const SubGroupModel = require('../group/subGroup.model').default;
const User = require('../user/user.model').default;
const Submission = require('../assessment/submission.model').default;
const Leaderboard = require('../leaderboard/leaderboard.model');
const Client = require('../client/client.model').default;
const APIError = require('../helpers/APIError');
const { getClientOfUser } = require('../user/utils/user');
const { default: logger } = require('../../config/winston');
const PhaseJeeConfigModel = require('./phaseJeeConfig.model');
const { default: PhaseMentorModel } = require('./PhaseMentor');

function addphase(req, res) {
	const {
		payload: { role, id: userId },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({
			success: false,
			role,
			message: 'You do not have required permission',
		});
		return;
	}
	const { name, from, till, supergroup: superGroupId, fee } = req.body;
	SuperGroupModel.get(superGroupId, { name: 1 }).then((supergroup) => {
		if (supergroup) {
			const phase = new Phase({
				name,
				startDate: from,
				endDate: till,
				supergroup,
				fee,
			});
			phase.save().then((savedPhase) => {
				Client.update({ moderators: userId }, { $push: { phases: savedPhase._id } })
					.then(() => {
						res.json({ success: true });
					})
					.catch(() => {
						res.json({ success: false, message: 'Unable to add to client' });
					});
			});
		} else {
			res.json({ success: false, message: 'SuperGroup not selected' });
		}
	});
}

function addphaseNew(req, res) {
	const {
		payload: { role, id },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false, message: 'You do not have required permission' });
		return;
	}
	const isAdminAdding = role === 'admin' || role === 'super';
	const {
		name,
		from,
		till,
		supergroup,
		subgroup: subGroupId,
		topics,
		tabs,
		restrictAccess,
		forSchool,
		attendanceType,
		client,
	} = req.body;

	const extraSave = {};

	if (isAdminAdding) {
		if (client) {
			extraSave.client = client;
		}
	}

	SuperGroupModel.get(supergroup).then((supergroup_) => {
		if (supergroup_) {
			const afterSubGroup = (savedGroup) => {
				supergroup_.subgroups.push({
					subgroup: savedGroup._id,
				});
				supergroup_.markModified('subgroups');
				supergroup_.save().then(() => {
					const topicMocks = tabs.indexOf('topicMocks') !== -1;
					const liveTests = tabs.indexOf('liveTests') !== -1;
					const fullMocks = tabs.indexOf('fullMocks') !== -1;
					const sectionalMocks = tabs.indexOf('sectionalMocks') !== -1;

					const phase = new Phase({
						name,
						startDate: from,
						endDate: till,
						supergroup,
						subgroups: [
							{
								subgroup: savedGroup._id,
							},
						],
						topics, // are these topics available??
						topicMocks,
						liveTests,
						fullMocks,
						sectionalMocks,
						isPrivate: !!restrictAccess,
						forSchool,
						attendanceType: forSchool ? attendanceType : 'lecture',
					});
					phase.save().then((savedPhase) => {
						SubGroupModel.update(
							{ _id: savedGroup._id },
							{ $push: { phases: { phase: savedPhase._id } } }
						).then(() => {
							if (!isAdminAdding) {
								Client.update(
									{ moderators: id },
									{ $push: { phases: savedPhase._id } }
								).then(() => {
									res.json({ success: true });
								});
							} else {
								if (client) {
									Client.update(
										{ _id: client },
										{ $push: { phases: savedPhase._id } }
									).then(() => {
										res.json({ success: true });
									});
								} else {
									res.json({ success: true });
								}
							}
						});
					});
				});
			};
			if (subGroupId) {
				SubGroupModel.findById(subGroupId).then((subGroup) =>
					afterSubGroup(subGroup)
				);
			} else {
				const group = new SubGroupModel({
					name,
					topics: [],
					supergroup,
					isPrivate: !!restrictAccess,
				});
				group.save().then((subGroup) => afterSubGroup(subGroup));
			}
		}
	});
}

function getrequests(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	const { phase } = req.params;

	User.find(
		{
			'subscriptions.subgroups.phases.phase': ObjectId(phase),
			'subscriptions.subgroups.phases.isAccessGranted': false,
		},
		{ subscriptions: 1, name: 1, username: 1, email: 1, mobileNumber: 1 }
	)
		.limit(1000)
		.then((users) => {
			const filteredUsers = users.filter((user) => {
				let found = false;
				user.subscriptions.forEach((subscription) => {
					subscription.subgroups.forEach((subgroup) => {
						subgroup.phases.forEach((p) => {
							if (
								p.phase.toString() == phase &&
								p.active &&
								p.isAccessGranted === false
							) {
								found = true;
							}
						});
					});
				});
				return found;
			});
			res.json({ success: true, users: filteredUsers });
		});
}

function grantaccess(req, res, next) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false, role, payload: req.payload });
		return;
	}

	const { phase: phaseId, user: userId } = req.body;

	User.findById(userId, { subscriptions: 1 })
		.then((user) => {
			user.subscriptions.forEach((subscription) => {
				subscription.subgroups.forEach((subgroup) => {
					subgroup.phases.forEach((p) => {
						if (p.active && p.phase.equals(phaseId) && p.isAccessGranted === false) {
							p.isAccessGranted = true;
						}
					});
				});
			});
			user.markModified('subscriptions');
			user.save().then(() => {
				UserCache.del(user._id);
				res.json({ success: true, user });
			});
		})
		.catch((error) => {
			next(new APIError(error, 500));
		});
}

function revokeUserAccess(req, res, next) {
	const { phase: phaseId, phases: phaseIds, revocationReason } = req.body;
	const { phases, user } = res.locals;
	const revokeFromPhases = isEmpty(phaseIds) ? [phaseId] : phaseIds;
	if (some(revokeFromPhases, (_phaseId) => !includes(phases, _phaseId))) {
		next(
			new APIError(
				JSON.stringify({ message: 'You do not have permission', phases, phaseId }),
				401
			)
		);
	} else if (user) {
		user.subscriptions.forEach((subscription) => {
			subscription.subgroups.forEach((subgroup) => {
				subgroup.phases.forEach((p) => {
					if (
						p.active &&
						includes(revokeFromPhases, p.phase.toString()) &&
						p.isAccessGranted === true
					) {
						p.isAccessGranted = false;
					}
					p.revocationReason = revocationReason;
				});
			});
		});
		user.markModified('subscriptions');
		user.save().then(() => {
			UserCache.del(user._id);
			res.json({ success: true, user });
		});
	} else {
		throw new Error('User not found');
	}
}

function updateusers(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}

	const { phase } = req.params;

	User.count({ 'subscriptions.subgroups.phases.phase': ObjectId(phase) }).then(
		(c) => {
			Phase.update({ _id: ObjectId(phase) }, { $set: { users: c } }).then(() => {
				res.json({ success: true });
			});
		}
	);
}

function matchPhase(phases, phase) {
	let found = false;
	phases.forEach((ph) => {
		if (ph.phase.toString() == phase) {
			found = true;
		}
	});
	return found;
}

function getUsersInPhase(req, res) {
	const {
		payload: { role, id },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.status(404).send({ message: '404 Not found', role });
	}
	const { phase } = req.params;
	let promise;
	if (role === 'admin' || role === 'super') {
		promise = new Promise((resolve) => {
			resolve([{ _id: phase }]);
		});
	} else {
		promise = Client.findOne({ moderators: ObjectId(id) }).then((client) => {
			if (client) {
				return Promise.resolve(client.phases.map((p) => ({ _id: p })));
			} else {
				return Promise.resolve([]);
			}
		});
	}
	promise
		.then((phases) => {
			if (
				phases.some((item) => item._id === phase || item._id.toString() === phase)
			) {
				User.find({
					'subscriptions.subgroups.phases.phase': phase,
				})
					.select('name username mobileNumber email createdAt')
					.exec((error, users) => {
						if (error) {
							res.status(500).send({ message: 'Internal server error', error });
						} else {
							res.send({ users });
						}
					});
			} else {
				res.status(400).send({ message: '404 not found' });
			}
		})
		.catch((error) => {
			res.status(404).send({
				error: error ? error.message : 'Unknown error',
				message: '404 not found!',
			});
		});
}

function getUEReport(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	const { phase } = req.params;
	const timeGap = 0.25 * 60 * 60 * 1000;
	const limit = 500;
	const rt = new Date().getTime() - timeGap;

	Phase.findOne({ _id: phase }, { name: 1 }).then((phase_) => {
		if (phase_) {
			UEReport.find({ phase })
				.populate([{ path: 'user', select: 'username name email' }])
				.then((uereports) => {
					const exclude = [];
					const ueReportByUser = {};
					uereports.forEach((uer) => {
						ueReportByUser[uer.user._id.toString()] = uer;
						if (uer.lastSynced.getTime() > rt) {
							exclude.push(uer.user._id);
						}
					});
					User.find(
						{
							'subscriptions.subgroups.phases.phase': ObjectId(phase),
							_id: { $nin: exclude },
						},
						{ _id: 1 }
					).then((totalUsers) => {
						User.find(
							{
								'subscriptions.subgroups.phases.phase': ObjectId(phase),
								_id: { $nin: exclude },
							},
							{ _id: 1 }
						)
							.limit(limit)
							.then((users) => {
								if (users.length) {
									const uIds = users.map((u) => u._id);
									Submission.find(
										{ user: { $in: uIds } },
										{ user: 1, assessmentWrapper: 1, 'meta.marks': 1, coreAnalysis: 1 }
									)
										.populate([
											{ path: 'assessmentWrapper', select: 'type name phases' },
											{ path: 'coreAnalysis', select: 'maxMarks' },
										])
										.then((submissions) => {
											const userData = {};
											users.forEach((u) => {
												userData[u._id.toString()] = {
													topicMocks: 0,
													overallRank: 999999,
													otherTests: [],
												};
											});
											submissions.forEach((submission) => {
												if (
													submission.assessmentWrapper &&
													matchPhase(submission.assessmentWrapper.phases, phase)
												) {
													if (!userData[submission.user.toString()]) {
														userData[submission.user.toString()] = {
															topicMocks: 0,
															overallRank: 999999,
															otherTests: [],
														};
													}
													if (submission.assessmentWrapper.type === 'TOPIC-MOCK') {
														userData[submission.user.toString()].topicMocks += 1;
													}
													if (
														['FULL-MOCK', 'LIVE-TEST', 'TOPIC-MOCK'].includes(
															submission.assessmentWrapper.type
														)
													) {
														if (submission.meta && submission.coreAnalysis.maxMarks) {
															const percent = Math.round(
																(100 * submission.meta.marks) / submission.coreAnalysis.maxMarks
															);

															userData[submission.user.toString()].otherTests.push({
																wrapperId: submission.assessmentWrapper._id,
																wrapperName: submission.assessmentWrapper.name,
																percent,
																marks: submission.meta.marks,
																maxMarks: submission.coreAnalysis.maxMarks,
															});
														}
													}
												}
											});
											Leaderboard.findOne({ phase: ObjectId(phase) }, { ratings: 1 }).then(
												(leaderboard) => {
													if (leaderboard && leaderboard.ratings) {
														leaderboard.ratings.sort((a, b) => {
															if (a.rating > b.rating) return -1;
															else if (a.rating < b.rating) return 1;
															else return 0;
														});
														leaderboard.ratings.forEach((r, i) => {
															if (userData[r.user.toString()]) {
																userData[r.user.toString()].overallRank = i + 1;
															}
														});
													}
													Object.keys(userData).forEach((k) => {
														if (ueReportByUser[k]) {
															ueReportByUser[k].topicMocks = userData[k].topicMocks;
															ueReportByUser[k].overallRank = userData[k].overallRank;
															ueReportByUser[k].otherTests = userData[k].otherTests;
															UEReport.update(
																{ _id: ueReportByUser[k]._id },
																{
																	$set: {
																		topicMocks: userData[k].topicMocks,
																		overallRank: userData[k].overallRank,
																		otherTests: userData[k].otherTests,
																		lastSynced: new Date(),
																	},
																}
															).exec();
														} else {
															UEReport.create({
																user: ObjectId(k),
																phase: ObjectId(phase),
																lastSynced: new Date(),
																topicMocks: userData[k].topicMocks,
																overallRank: userData[k].overallRank,
																otherTests: userData[k].otherTests,
															});
														}
													});
													res.json({
														success: true,
														processed: users.length,
														totalUsers: totalUsers.length,
													});
												}
											);
										});
								} else {
									const header = ['_id', 'email', 'name', 'username', 'topicMocks'];
									const data = [];
									const namesByWrapperId = {};
									uereports.forEach((uer) => {
										uer.otherTests.forEach((or) => {
											if (!namesByWrapperId[or.wrapperId]) {
												namesByWrapperId[or.wrapperId] = or.wrapperName;
											}
										});
									});
									const otherTestWrapperIds = [];
									Object.keys(namesByWrapperId).forEach((wrapperId) => {
										otherTestWrapperIds.push(wrapperId);
										const wrapperName = namesByWrapperId[wrapperId];
										header.push(`${wrapperName}(Percentage)`);
										header.push(`${wrapperName}(Marks Scored)`);
										header.push(`${wrapperName}(Max Marks)`);
									});
									uereports.forEach((uer) => {
										const { user } = uer;
										const row = [
											uer._id,
											user.email,
											user.name,
											user.username,
											user.topicMocks,
										];
										const dataByWrapperId = {};
										uer.otherTests.forEach((ot) => {
											dataByWrapperId[ot.wrapperId] = ot;
										});
										otherTestWrapperIds.forEach((wrapperId) => {
											const wrapperResult = dataByWrapperId[wrapperId];
											row.push(get(wrapperResult, 'percent', 'NA'));
											row.push(get(wrapperResult, 'marks', 'NA'));
											row.push(get(wrapperResult, 'maxMarks', 'NA'));
										});
										data.push(row);
									});
									res.json({
										success: true,
										processed: 0,
										csv: convertArrayToCSV(data, { header }),
										name: phase_.name,
										totalUsers: totalUsers.length,
									});
								}
							});
					});
				});
		} else {
			res.json({ success: false });
		}
	});
}

async function getPhaseSubjects(req, res) {
	const { phase } = req.params;
	const { id, role } = req.payload;

	if (!phase) {
		res.send({ success: false, msg: 'Phase is not passed' });
		return;
	}

	Phase.findById(phase)
		.populate('subjects')
		.then((phase) => {
			if (!phase) {
				res.send({ success: false, msg: 'Phase not found' });
				return;
			}
			res.send({ success: true, subjects: phase.subjects });
		})
		.catch((Err) => {
			res.send({ success: false, msg: 'Error while fetching subjects' });
		});
}

const getPhaseWithSubgroups = async (req, res) => {
	try {
		const { id: userId, role } = req.payload;

		const user = await User.findById(userId).populate({
			path: 'subscriptions.subgroups.phases.phase',
			select: 'name subgroups',
			populate: { path: 'subgroups.subgroup', select: 'name' },
		});

		if (!user) return res.send({ success: false, msg: 'User not found!' });

		if (role === 'moderator') {
			Client.findOne({ moderators: userId })
				.populate({
					path: 'phases',
					select: 'name subgroups',
					populate: { path: 'subgroups.subgroup', select: 'name' },
				})
				.then((populatedClient) => {
					if (!populatedClient)
						res.send({ success: false, msg: 'Client not found!' });
					else
						res.send({
							success: true,
							phases: reverse(populatedClient ? populatedClient.phases : []),
						});
				})
				.catch((err) =>
					res.send({ success: false, msg: 'Error while getting phases' })
				);
		} else if (role === 'mentor') {
			const phases = [];
			forEach(user.subscriptions, (subs) => {
				forEach(subs.subgroups, (sub) => {
					forEach(sub.phases, (phs) => {
						const phase = get(phs, 'phase');
						if (phase) phases.push(phase);
					});
				});
			});
			const phaseMentor = await PhaseMentorModel.find({ user: userId }).populate({
				path: 'phases',
				select: 'name subgroups',
				populate: { path: 'subgroups.subgroup', select: 'name' },
			});
			forEach(phaseMentor, (ph) => {
				phases.push(ph.phase);
			});
			return res.send({ success: true, phases });
		} else if (role === 'admin' || role === 'super') {
			Phase.find({})
				.select('subgroups name')
				.sort({ createdAt: -1 })
				.populate({ path: 'subgroups.subgroup', select: 'name' })
				.then((phases) => res.send({ success: true, phases }))
				.catch((err) =>
					res.send({ success: false, msg: 'Error while fetching phases' })
				);
		} else {
			res.send({
				success: false,
				msg: 'you are not authenticated to perform action',
			});
		}
	} catch (err) {
		console.log(err);
		logger.info({ err: err.message });
		return res.send({ success: false, msg: 'Error while processing request' });
	}
};

const updatePhaseJeeConfig = async (req, res) => {
	const { id, config } = req.body;
	if (!id || !config)
		return res.send({ success: false, msg: 'Please send proper params!' });

	let exist = await PhaseJeeConfigModel.findOne({ phase: id });
	if (!exist) {
		exist = new PhaseJeeConfigModel();
		exist.phase = id;
	}
	exist.studentName = config.studentName;
	exist.fatherName = config.fatherName;
	exist.motherName = config.motherName;
	exist.instituteRollNo = config.instituteRollNo;
	exist.jeeMainsDOB = config.jeeMainsDOB;
	exist.jeeRegNoDOB = config.jeeMainsRegNo;
	exist.jeeMainsRollNo = config.jeeMainsRollNo;
	exist.jeeMainsMobile = config.jeeMainsMobile;
	exist.jeeMainsEmail = config.jeeMainsEmail;
	exist.jeeAdvancedRollNo = config.jeeAdvancedRollNo;
	exist.jeeAdvancedMobile = config.jeeAdvancedMobile;
	exist.jeeAdvancedEmail = config.jeeAdvancedEmail;
	exist.jeeAdvancedDOB = config.jeeAdvancedDOB;
	exist.save((err) => {
		if (err) res.send({ success: false, msg: 'Error while updating!' });
		else res.send({ success: true, msg: 'Successfully saved!' });
	});
};

const getPhaseConfig = (req, res) => {
	const { id } = req.query;
	PhaseJeeConfigModel.findOne({ phase: id })
		.then((cfg) => {
			if (!cfg) res.send({ success: false, msg: 'Config not found!' });
			else res.send({ success: true, cfg });
		})
		.catch((err) =>
			res.send({ success: false, msg: 'Error while fetching config!' })
		);
};

module.exports = {
	addphase,
	addphaseNew,
	getrequests,
	grantaccess,
	updateusers,
	getUEReport,
	getUsersInPhase,
	revokeUserAccess,
	getPhaseSubjects,
	getPhaseWithSubgroups,
	updatePhaseJeeConfig,
	getPhaseConfig,
};
