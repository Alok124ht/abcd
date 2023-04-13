const { convertArrayToCSV } = require('convert-array-to-csv');
const moment = require('moment');
const {
	filter,
	forEach,
	get,
	isEmpty,
	map,
	reduce,
	size,
	slice,
	sortBy,
} = require('lodash');
const SuperGroupModel = require('../../group/superGroup.model').default;
const AssessmentWrapper = require('../../assessment/assessmentWrapper.model')
	.default;
const User = require('../../user/user.model').default;
const Attempt = require('../../models/Attempt').default;
const Session = require('../../session/session.model').default;
const Submission = require('../../assessment/submission.model').default;
const Topic = require('../../topic/topic.model').default;
const Phase = require('../../phase/phase.model').default;
const { getActivePhasesFromSubscriptions } = require('../../utils/phase');
const APIError = require('../../helpers/APIError');

const DATE_FORMAT = 'DD MMM YYYY hh:mm A';

const getActiveUsersList = (durationQuery) =>
	new Promise((resolve, reject) => {
		User.find({ createdAt: durationQuery })
			.select('_id')
			.then((users) => {
				const usersById = {};
				forEach(users, (user) => {
					usersById[user._id] = 1;
				});
				Attempt.distinct('user', { startTime: durationQuery }, (err, userIds) => {
					if (err) {
						reject(err);
					} else {
						forEach(userIds, (uId) => {
							usersById[uId] = 1;
						});
						Submission.distinct(
							'user',
							{ createdAt: durationQuery },
							(sError, submissionUserIds) => {
								if (sError) {
									reject(sError);
								} else {
									forEach(submissionUserIds, (userId) => {
										usersById[userId] = 1;
									});

									resolve(map(usersById, (value, userId) => userId));
								}
							}
						);
					}
				});
			});
	});

const getActiveUsers = async (req, res, next) => {
	const from = moment(req.query.from).toDate();
	const till = moment(req.query.till).toDate();
	const durationQuery = { $gte: from, $lte: till };
	const { superGroups } = req.query;
	let subscriptionsQuery;
	if (superGroups) {
		subscriptionsQuery = { 'subscriptions.group': superGroups };
	} else {
		subscriptionsQuery = {};
	}

	const allUsersOfPhase = await User.find({ ...subscriptionsQuery })
		.select('_id')
		.exec();
	const allUserIds = allUsersOfPhase.map((u) => u._id);

	User.find({ createdAt: durationQuery, _id: { $in: allUserIds } })
		.select('_id')
		.then((users) => {
			const totalSignups = size(users);
			const usersById = {};
			forEach(users, (user) => {
				usersById[user._id] = 1;
			});
			Attempt.distinct(
				'user',
				{ startTime: durationQuery, user: { $in: allUserIds } },
				(err, userIds) => {
					if (err) {
						next(err);
					} else {
						forEach(userIds, (uId) => {
							usersById[uId] = 1;
						});
						Submission.distinct(
							'user',
							{ createdAt: durationQuery, user: { $in: allUserIds } },
							(sError, submissionUserIds) => {
								if (sError) {
									next(sError);
								} else {
									forEach(submissionUserIds, (userId) => {
										usersById[userId] = 1;
									});

									res.send({
										totalSignups,
										activeUsers: size(usersById),
										totalUserIn: size(allUsersOfPhase),
										durationQuery,
										subscriptionsQuery,
									});
								}
							}
						);
					}
				}
			);
		});
};

const getUsersWithGoal = (req, res, next) => {
	User.aggregate([
		{ $match: { 'settings.goal': { $elemMatch: { $exists: true } } } },
		{
			$project: {
				size: {
					$size: {
						$cond: [{ $ifNull: ['$settings.goal', []] }, '$settings.goal', []],
					},
				},
			},
		},
		{
			$group: {
				_id: '$size',
				count: {
					$sum: 1,
				},
			},
		},
		{
			$project: {
				numberOfTimesUpdated: '$_id',
				count: '$count',
			},
		},
		{
			$sort: {
				numberOfTimesUpdated: 1,
			},
		},
	]).exec((err, result) => {
		if (err) {
			next(err);
		} else {
			res.send({ result });
		}
	});
};

const getPracticeReport = (req, res, next) => {
	const supergroups = req.query.supergroups || [];
	const attemptMoreThanRaw = parseInt(req.query.attemptMoreThan, 10);
	const attemptMoreThan = isNaN(attemptMoreThanRaw) ? 20 : attemptMoreThanRaw;
	const monthsRaw = parseInt(req.query.months, 10);
	const months = isNaN(monthsRaw) ? 1 : monthsRaw;
	const duration = months * 30 * 24 * 60 * 60 * 1000;
	const durationQuery = { $gte: new Date(Date.now() - duration) };

	getActiveUsersList(durationQuery)
		.then((allActiveUsers) => {
			User.find(
				{ _id: { $in: allActiveUsers }, 'subscriptions.group': supergroups },
				'stats.topics',
				(countError, users) => {
					if (countError) {
						next(countError);
					} else {
						const filteredSubTopics = {};
						forEach(users, (user) => {
							forEach(get(user, 'stats.topics'), (topic) => {
								forEach(get(topic, 'sub_topics'), (subTopic) => {
									if (size(get(subTopic, 'questions')) > attemptMoreThan) {
										if (!filteredSubTopics[subTopic.id]) {
											filteredSubTopics[subTopic.id] = 0;
										}
										filteredSubTopics[subTopic.id] += 1;
									}
								});
							});
						});
						Topic.getSubTopics()
							.then((subTopics) => {
								const subTopicsById = {};
								forEach(subTopics, (subTopic) => {
									subTopicsById[subTopic._id] = subTopic;
								});
								forEach(filteredSubTopics, (value, key) => {
									filteredSubTopics[key] = {
										noOfStudents: value,
										subTopic: subTopicsById[key],
										_id: key,
									};
								});
								res.send({
									totalActiveUsers: size(users),
									filteredSubTopics: sortBy(
										map(filteredSubTopics),
										(v) => -1 * v.noOfStudents
									),
								});
							})
							.catch(next);
					}
				}
			);
		})
		.catch(next);
};

const createGetAssessmentWrapperIdsInPhase = () => {
	const assessmentWrapperIdsByPhaseId = {};
	return (phaseId, date) =>
		new Promise((resolve) => {
			const done = () => {
				resolve(assessmentWrapperIdsByPhaseId[phaseId]);
			};
			if (assessmentWrapperIdsByPhaseId[phaseId]) {
				done();
			} else {
				Phase.findById(phaseId)
					.select('name')
					.then((phase) =>
						AssessmentWrapper.find(
							{
								'phases.phase': phaseId,
								visibleFrom: { $lte: date || Date.now() },
							},
							{
								core: 1,
							}
						).then((assessmentWrappers) => {
							const assessmentIds = {
								name: phase.name,
								size: size(assessmentWrappers),
							};
							forEach(assessmentWrappers, (wrapper) => {
								assessmentIds[wrapper._id] = { _id: wrapper._id, coreId: wrapper.core };
							});
							assessmentWrapperIdsByPhaseId[phaseId] = assessmentIds;
							done();
						})
					);
			}
		});
};

const getUserWithActivePhase = (user) => ({
	...user.toObject(),
	activePhases: getActivePhasesFromSubscriptions(user.subscriptions),
});

const getUserPerformanceReport = (req, res, next) => {
	const { userSelectionType } = req.query;
	const skip = parseInt(req.query.skip, 10);
	const limit = parseInt(req.query.limit, 10);
	const supergroups = req.query.supergroups || [];
	const monthsRaw = parseFloat(req.query.months);
	const months = Number.isNaN(monthsRaw) ? 1 : monthsRaw;
	const duration = months * 30 * 24 * 60 * 60 * 1000;
	const durationQuery = { $gte: new Date(Date.now() - duration) };
	const totatlQuestionCountByAssessmentCoreId = {};
	const assessmentIdGetter = createGetAssessmentWrapperIdsInPhase();
	const processUsers = (users) => {
		Promise.all(
			map(
				filter(
					map(users, (user) => {
						try {
							return getUserWithActivePhase(user);
						} catch (e) {
							return null;
						}
					}),
					(e) => !!e
				),
				(user) =>
					new Promise((resolve) => {
						assessmentIdGetter(get(user.activePhases, '0')).then(
							(assessmentWrapperForCurrentPhase) => {
								let sessionCorrectCount = 0;
								let sessionIncorrectCount = 0;
								let sessionUnattemptedCount = 0;
								let isSessionAnalysisComplete = false;
								let isAssessmentAnalysisComplete = false;
								let submissionCorrect = 0;
								let submissionIncorrect = 0;
								let submissionUnattempted = 0;
								let attemptedAssessments = 0;
								let notFromCurrentPhase = 0;

								const onComplete = () => {
									resolve({
										sessionCorrectCount,
										sessionIncorrectCount,
										sessionUnattemptedCount,
										submissionCorrect,
										submissionIncorrect,
										submissionUnattempted,
										attemptedAssessments,
										email: get(user, 'email'),
										name: get(user, 'name'),
										totalAssessmentsInCurrentPhase: get(
											assessmentWrapperForCurrentPhase,
											'size'
										),
										notFromCurrentPhase,
										currentPhase: get(assessmentWrapperForCurrentPhase, 'name'),
									});
								};
								const onProgress = () => {
									if (isSessionAnalysisComplete && isAssessmentAnalysisComplete) {
										onComplete();
									}
								};
								const onSessionAnalysis = () => {
									isSessionAnalysisComplete = true;
									onProgress();
								};
								const onAssessmentAnalysis = () => {
									isAssessmentAnalysisComplete = true;
									onProgress();
								};
								Session.find({ user: user._id })
									.select('questions')
									.populate([{ path: 'questions.attempt', select: 'isCorrect' }])
									.then((sessions) => {
										forEach(sessions, (session) => {
											forEach(session.questions, (questionItem) => {
												if (!get(questionItem, 'attempt')) {
													return;
												}
												if (get(questionItem, 'attempt.isCorrect')) {
													sessionCorrectCount += 1;
												} else if (get(questionItem, 'attempt.isAnswered')) {
													sessionIncorrectCount += 1;
												} else {
													sessionUnattemptedCount += 1;
												}
											});
										});
										onSessionAnalysis();
									})
									.catch((error) => {
										console.error(error);
										onSessionAnalysis();
									});
								Submission.find({ user: user._id })
									.select('meta assessmentCore assessmentWrapper')
									.populate([{ path: 'assessmentCore', select: 'sections.questions' }])
									.then((submissions) => {
										forEach(submissions, (submission) => {
											submissionCorrect += get(submission, 'meta.correctQuestions');
											submissionIncorrect += get(submission, 'meta.incorrectQuestions');
											if (!totatlQuestionCountByAssessmentCoreId[submission._id]) {
												totatlQuestionCountByAssessmentCoreId[submission._id] = reduce(
													get(submission, 'assessmentCore.sections'),
													(result, section) => size(section.questions) + result,
													0
												);
											}
											const totalQuestions =
												totatlQuestionCountByAssessmentCoreId[submission._id];
											submissionUnattempted +=
												totalQuestions -
												get(submission, 'meta.correctQuestions') -
												get(submission, 'meta.incorrectQuestions');
										});
										attemptedAssessments = size(submissions);
										notFromCurrentPhase = size(
											filter(
												submissions,
												(submission) =>
													assessmentWrapperForCurrentPhase[submission.assessmentWrapper]
											)
										);
										onAssessmentAnalysis();
									})
									.catch(() => {
										onAssessmentAnalysis();
									});
							}
						);
					})
			)
		)
			.then((results) => {
				const header = [
					'Email',
					'Name',
					'Correct  Question Count (In Sessions)',
					'Incorrect Question Count (In Sessions)',
					'Unattempted Question Count (In Sessions)',
					'Correct  Question Count (In Assessments)',
					'Incorrect Question Count (In Assessments)',
					'Unattempted Question Count (In Assessments)',
					'Number of Assessments attempted',
					'Total number of assessments available in current Phase',
					'Total number of assessments not from current phase',
					'Current Phase',
				];
				const csv = convertArrayToCSV(
					map(
						sortBy(results, (result) => result.p),
						(item) => {
							if (isEmpty(item)) {
								return [];
							}
							return [
								item.email,
								item.name,
								item.sessionCorrectCount,
								item.sessionIncorrectCount,
								item.sessionUnattemptedCount,
								item.submissionCorrect,
								item.submissionIncorrect,
								item.submissionUnattempted,
								item.attemptedAssessments,
								item.totalAssessmentsInCurrentPhase,
								item.notFromCurrentPhase,
								item.currentPhase,
							];
						}
					),
					{ header }
				);
				res.type('text/csv');
				res.send(csv);
				// res.send(sortBy(results, (result) => result.p));
			})
			.catch(next);
	};
	if (userSelectionType === 'active') {
		getActiveUsersList(durationQuery).then((allActiveUsers) => {
			const filteredUsers = slice(allActiveUsers, skip, skip + limit);
			User.find({
				_id: { $in: filteredUsers },
				'subscriptions.group': supergroups,
			})
				.select('_id email name subscriptions')
				// .limit(100)
				.exec((searchError, users) => {
					if (searchError) {
						next(searchError);
					} else {
						processUsers(users);
					}
				});
		});
	} else {
		User.find({ 'subscriptions.group': supergroups })
			.select('_id email name subscriptions')
			.limit(limit)
			.skip(skip)
			.then(processUsers)
			.catch(next);
	}
};

const getSignUpReport = (req, res, next) => {
	const { from, to } = req.query;
	SuperGroupModel.find()
		.select('name')
		.exec((searchError, superGroups) => {
			if (searchError) {
				next(searchError);
			} else {
				Promise.all(
					map(superGroups, (superGroup) =>
						User.count({
							'subscriptions.group': superGroup._id,
							createdAt: { $lte: to, $gte: from },
						}).then((count) => ({
							name: superGroup.name,
							_id: superGroup._id,
							count,
						}))
					)
				)
					.then((results) => {
						// res.send(results)
						const header = ['Super Group', 'Sign Up Count', 'From', 'To'];
						const fromMoment = moment(new Date(from));
						const toMoment = moment(new Date(to));
						const data = [];
						forEach(results, (result) => {
							data.push([
								`${result.name}(${result._id})`,
								result.count,
								fromMoment.format(DATE_FORMAT),
								toMoment.format(DATE_FORMAT),
							]);
						});
						res.attachment(
							`sign-up-from-${fromMoment.format('DD:MMM:YYYY')}-till-${toMoment.format(
								'DD:MMM:YYYY'
							)}.csv`
						);
						res.type('text/csv');
						res.send(convertArrayToCSV(data, { header }));
					})
					.catch(next);
			}
		});
};

const getUserGrowth = (req, res, next) => {
	const {
		startDate: startDateRaw,
		endDate: endDateRaw,
		superGroups,
	} = req.query;
	const startDate = new Date(startDateRaw);
	const endDate = new Date(endDateRaw);
	const match = {
		$and: [{ createdAt: { $gte: startDate } }, { createdAt: { $lte: endDate } }],
	};
	if (superGroups) {
		match.$and.push({ 'subscriptions.group': { $in: superGroups } });
	}
	User.aggregate([
		{
			$match: match,
		},
		{
			$group: {
				_id: {
					day: { $dayOfMonth: '$createdAt' },
					month: { $month: '$createdAt' },
					year: { $year: '$createdAt' },
				},
				count: { $sum: 1 },
				date: { $first: '$createdAt' },
			},
		},
		{
			$project: {
				date: {
					$dateToString: { format: '%Y-%m-%d', date: '$date' },
				},
				count: 1,
				_id: 0,
			},
		},
	])
		.then((aggregate) => {
			res.send(aggregate);
		})
		.catch((error) => {
			next(new APIError(error.message, 422, true));
		});
};

module.exports = {
	getActiveUsers,
	getPracticeReport,
	getSignUpReport,
	getUsersWithGoal,
	getUserGrowth,
	getUserPerformanceReport,
};
