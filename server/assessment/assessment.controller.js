/* eslint-disable camelcase */
/* eslint-disable prefer-const */
/* eslint-disable no-plusplus */
/* eslint-disable block-scoped-var */
/* eslint-disable no-redeclare */
/* eslint-disable no-var */
/* eslint-disable no-loop-func */
/* eslint-disable vars-on-top */
/* eslint-disable no-param-reassign */
/* eslint-disable linebreak-style */
/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
const { concat, forEach, toString, trim, get } = require('lodash');
const mongoose = require('mongoose');
const { convertArrayToCSV } = require('convert-array-to-csv');
const dayjs = require('dayjs');
const AssessmentCore = require('./assessmentCore.model').default;
const AssessmentWrapper = require('./assessmentWrapper.model').default;
const CoreAnalysis = require('./coreAnalysis.model').default;
const User = require('../user/user.model').default;
const Usercategory = require('../user/usercategory.model').default;
const Question = require('../question/question.model').default;
const logger = require('../../config/winston').default;
const WrapperAnalysis = require('./wrapperAnalysis.model').default;
const TopicCache = require('../cache/Topic');
const Submission = require('./submission.model').default;
const Leaderboard = require('../leaderboard/leaderboard.model');
const PreAnalysis = require('./preAnalysis.model');
const {
	secureWrapperAnalysis,
	secureCoreAnalysis,
	getRanking,
	selectQuestions,
	getCorrectOptions,
} = require('./lib');
const Log = require('../log/log.model');
const Draft = require('../draft/draft.model');
const Client = require('../client/client.model').default;
const AssessmentCoreCache = require('../cache/AssessmentCore');
const WrapperData = require('../globals/WrapperData');
const GradeTime = require('./gradeTime.model').default;
const APIError = require('../helpers/APIError');
const { generateInstructions } = require('../draft/instructions');
const { clearPhaseWrapperCache } = require('./utils/cache');
const {
	shuffle,
	getTotalQuestions,
	isAnswerCorrect,
	getMaxMarks,
} = require('../lib.js');
const {
	gradeSubmissionsUpdateAssessment,
	reGradeCore,
	gradeAllSections,
} = require('./gradeLib');
const { updateCategory } = require('./categoryLib');
const { isAtLeast } = require('../utils/user/role');
const { getActivePhasesFromSubscriptions } = require('../utils/phase');
const { default: questionModel } = require('../question/question.model');
const { default: ServicePlan } = require('../models/ServicePlan');
const { default: UserModel } = require('../user/user.model');
const { UserRole } = require('../user/IUser');
const { default: UserLiveAssessment } = require('../user/UserLiveAssessment');
const { dateToStartTime, dateToEndTime } = require('../utils/date');

const { ObjectId } = mongoose.Types;

function getassessmentwrapper(_req, res) {
	const {
		assessmentWrapper,
		isLoggedIn,
		accessAllowed,
		isAlreadyAttempted,
		isAvailableForPhase,
	} = res.locals;
	AssessmentCoreCache.get(assessmentWrapper.core, (error, assessmentCore) => {
		if (error || !assessmentCore) {
			res
				.status(422)
				.send({ error: { code: 'assessment-not-found' }, success: false });
		} else {
			TopicCache.get((err, data) => {
				if (err) {
					res
						.status(422)
						.send({ error: { code: 'topic-cache-issue' }, success: false });
				} else if (!data) {
					res
						.status(422)
						.send({ error: { code: 'topic-cache-issue' }, success: false });
				} else {
					const { topics } = data;
					const topicMap = {};
					const impTopics = [];
					assessmentCore.syllabus.topics.forEach((t) => {
						impTopics.push(t.id);
						t.subTopics.forEach((st) => {
							impTopics.push(st.id);
						});
					});

					forEach(topics, (t) => {
						if (impTopics.indexOf(t._id.toString()) !== -1) {
							topicMap[t._id] = t.name;
						}
						t.sub_topics.forEach((st) => {
							if (impTopics.indexOf(st._id.toString()) !== -1) {
								topicMap[st._id] = st.name;
							}
						});
					});

					res.json({
						isLoggedIn,
						accessAllowed,
						isAlreadyAttempted,
						isAvailableForPhase,
						assessmentWrapper,
						assessmentCore,
						topicMap,
						success: true,
					});
				}
			});
		}
	});
}

function filterUsedIn(core, phases) {
	const phaseMap = {};
	phases.forEach((phase) => {
		phaseMap[phase] = true;
	});

	core.sections.forEach((section) => {
		section.questions.forEach((question) => {
			question.question.usedIn = question.question.usedIn.filter((usedInItem) => {
				const wrappers = usedInItem.wrappers.filter((wrapper) => {
					let phaseFound = false;
					wrapper.wrapper.phases.forEach((phase) => {
						if (phaseMap[phase.phase]) {
							phaseFound = true;
						}
					});
					return phaseFound;
				});
				// eslint-disable-next-line no-param-reassign
				usedInItem.wrappers = wrappers;
				return wrappers.length;
			});
		});
	});
	return core;
}

function view(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `assessment${req.url}`,
		params: req.body,
	});
	const {
		payload: { role },
	} = req;
	const { phases } = res.locals;
	AssessmentCore.findOne({ _id: req.params.assessmentId })
		.populate([
			{ path: 'preAnalysis analysis' },
			{
				path: 'sections.questions.question',
				populate: [
					{
						path: 'usedIn',
						select: 'identifier wrappers',
						populate: [{ path: 'wrappers.wrapper', select: 'name phases' }],
					},
				],
			},
			{
				path: 'wrappers.wrapper',
				select: 'name analysis',
				populate: [{ path: 'analysis', select: 'bonus' }],
			},
		])
		.then((core) => {
			if (core) {
				res.json({
					success: true,
					assessment: isAtLeast('admin', role) ? core : filterUsedIn(core, phases),
				});
			} else {
				res.json({ success: false });
			}
		});
}

function gradeSubmissionsGeneric(assessmentWrapper, options) {
	const assessmentCore = assessmentWrapper.core;
	const wrapperAnalysis = assessmentWrapper.analysis;
	const { runInBackground } = options || {};
	logger.info('inside gradeSubmissionsGeneric');
	const exclude = wrapperAnalysis.submissions.map((s) => s.submission);
	return Submission.find({
		assessmentWrapper: assessmentWrapper._id,
		_id: { $nin: exclude },
	})
		.populate([{ path: 'user', select: 'subscriptions' }])
		.then((submissions) => {
			logger.info(
				`inside gradeSubmissionsGeneric, number of submissions excluding already graded: ${submissions.length}`
			);
			const task = () => {
				logger.info('Calling gradeSubmissionsUpdateAssessment');
				gradeSubmissionsUpdateAssessment(
					assessmentWrapper,
					assessmentCore,
					wrapperAnalysis,
					submissions,
					'wrapper'
				);
			};
			if (runInBackground) {
				const promise = new Promise((resolve) => {
					task();
					setTimeout(() => {
						resolve();
					}, 1000);
				}, []);
				promise.then(() => {
					logger.info('data processed successfully');
				});
				logger.info(
					'task is running in background. Returning data before it is complete.'
				);
			} else {
				task();
			}
			return Promise.resolve({
				excludedSubmissions: exclude,
				gradedSubmissionCount: submissions.length,
				assessmentWrapper,
			});
		})
		.catch((error) => {
			logger.info(
				`error finding submissions of wrapper ${assessmentWrapper._id}, ${
					(error && error.message) || 'Unknown error'
				}`
			);
		});
}

function initializeCategory(user) {
	const usercat = new Usercategory({
		user: user._id,
		topics: [],
		assessments: [],
	});
	return usercat
		.save()
		.then((savedCategory) =>
			User.update(
				{ _id: user._id },
				{ $set: { category: savedCategory._id } }
			).then(() => Promise.resolve(savedCategory._id))
		);
}

function getFirstTimeAccuracy(sections, flow) {
	const firstTimeAnswers = {};
	const firstTimeActions = {};
	let firstSeenCorrect = 0;
	let firstSeenIncorrect = 0;
	let firstSeenSkip = 0;

	flow.forEach((f) => {
		if (
			f.response !== undefined &&
			firstTimeActions[`${f.section}-${f.question}`] === undefined
		) {
			if (f.response === null) {
				firstSeenSkip += 1;
			} else if (
				// what about bonus??
				isAnswerCorrect(
					f.response,
					sections[f.section].questions[f.question].question
				)
			) {
				firstSeenCorrect += 1;
			} else {
				firstSeenIncorrect += 1;
			}
			firstTimeActions[`${f.section}-${f.question}`] = f.response;
		}

		if (
			f.response &&
			firstTimeAnswers[`${f.section}-${f.question}`] === undefined
		) {
			firstTimeAnswers[`${f.section}-${f.question}`] = f.response;
		}
	});

	let correct = 0;
	let incorrect = 0;
	Object.keys(firstTimeAnswers).forEach((k) => {
		const s = k.split('-')[0];
		const q = k.split('-')[1];
		if (isAnswerCorrect(firstTimeAnswers[k], sections[s].questions[q].question)) {
			correct += 1;
		} else incorrect += 1;
	});

	return {
		correct,
		incorrect,
		firstSeenCorrect,
		firstSeenIncorrect,
		firstSeenSkip,
	};
}

function getAvgQuestionAccuracy(assessment) {
	let sumAccuracy = 0;
	let totalAccuracy = 0;
	assessment.analysis.sections.forEach((section) => {
		section.questions.forEach((question) => {
			sumAccuracy += question.totalAttempts
				? question.correctAttempts / question.totalAttempts
				: 0;
			totalAccuracy += 1;
		});
	});
	return totalAccuracy ? sumAccuracy / totalAccuracy : 0;
}

function getPickingAbility(submission, assessment) {
	// correlation of 0.495 without using flow
	// a = number of tough questions skipped, accuracy < avg accuracy of question
	// b = number of easy questions skipped, accuracy > avg accuracy of question
	const threshold = getAvgQuestionAccuracy(assessment);
	let pickingAbility = 0;
	const { totalAttempts } = assessment.analysis;
	if (totalAttempts < 30) {
		return { pickingAbility: 0 };
	}
	submission.meta.sections.forEach((section, sidx) => {
		section.questions.forEach((question, qidx) => {
			const qA = assessment.analysis.sections[sidx].questions[qidx];
			const qAA = qA.totalAttempts ? qA.correctAttempts / qA.totalAttempts : 0;
			if (qAA > threshold && question.correct === -1) {
				// left easy question
				pickingAbility -= 1;
			} else if (qAA > threshold && question.correct === -1) {
				// left tough question
				pickingAbility += 1;
			}
		});
	});
	return { pickingAbility };
}

function updateUserCategory(user, assessment, submission) {
	if (user.category === undefined) {
		initializeCategory(user).then((categoryId) => {
			Usercategory.findOne({ _id: categoryId }).then((category) => {
				updateCategory(category, assessment, submission);
			});
		});
	} else {
		Usercategory.findOne({ _id: user.category }).then((category) => {
			updateCategory(category, assessment, submission);
		});
	}
}

function reCalculateCategories(assessment) {
	// only for live submissions for now!!

	const ids = assessment.analysis.submissions.map((s) => s.submission);
	return Submission.getAllGraded2(ids).then((submissions) => {
		let sumAccuracy = 0;
		let sumSqAccuracy = 0;
		let sumPickingAbility = 0;
		let sumSqPickingAbility = 0;
		submissions.forEach((submission) => {
			const precision = submission.meta.precision ? submission.meta.precision : 0;
			const { pickingAbility } = getPickingAbility(submission, assessment);
			sumPickingAbility += pickingAbility;
			sumSqPickingAbility += pickingAbility * pickingAbility;
			sumAccuracy += precision / 100.0;
			sumSqAccuracy += (precision * precision) / 10000.0;
		});

		submissions.forEach((submission) => {
			updateUserCategory(submission.user, assessment, submission);
		});

		return CoreAnalysis.update(
			{ _id: assessment.analysis._id },
			{
				$set: {
					sumPickingAbility,
					sumSqPickingAbility,
					lastCategorized: new Date(),
				},
			}
		).then(() =>
			Promise.resolve({
				sumAccuracy,
				sumSqAccuracy,
				total: ids.length,
			})
		);
	});
}

function categorizeCore(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `assessment${req.url}`,
		params: req.body,
	});
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}
	AssessmentCore.findOne({ _id: req.params.coreId })
		.populate([
			{
				path: 'sections.questions.question',
				populate: [{ path: 'statistics' }],
			},
			{ path: 'analysis' },
		])
		.exec()
		.then((assessmentCore) => {
			reCalculateCategories(assessmentCore).then((data) => {
				res.json({ data });
			});
		});
}

function gradewrapper(req, res, next) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `assessment${req.url}`,
		params: req.body,
	});

	// this will clean wrapper data. grade all submissions, and add wrapper data.
	// and set graded to true.
	logger.info('gradewrapper called');

	AssessmentWrapper.findById(req.params.wrapperId)
		.populate([
			{
				path: 'core',
				populate: [
					{
						path: 'sections.questions.question',
						populate: [{ path: 'statistics' }],
					},
					{ path: 'preAnalysis analysis' },
				],
			},
			{
				path: 'analysis',
			},
		])
		.then((assessmentWrapper) => {
			if (assessmentWrapper) {
				WrapperData.remove({
					wrapperAnalysis: assessmentWrapper.analysis._id,
				}).then(() => {
					const timeNow = new Date().getTime();
					const { availableTill } = assessmentWrapper;
					if (timeNow < availableTill.getTime()) {
						// not used
						res.status(422).json({ error: { code: 'assessment-not-ended' } });
						return;
					}

					logger.info('calling gradeSubmissionsGeneric');

					gradeSubmissionsGeneric(assessmentWrapper, { runInBackground: true })
						.then(
							({
								excludedSubmissions,
								gradedSubmissionCount,
								assessmentWrapper: assessment,
							}) => {
								logger.info('gradeSubmissionsGeneric completed successfully');
								AssessmentWrapper.update(
									{ _id: assessmentWrapper._id },
									{ $set: { graded: true } }
								)
									.then(() => {
										res.json({
											success: true,
											assessment,
											excludedSubmissions,
											gradedSubmissionCount,
										});
									})
									.catch((error) => {
										res.status(500).send({ message: 'Error', error });
									});
							}
						)
						.catch((error) => {
							logger.error('gradeSubmissionsGeneric failed');
							next(error);
						}); // try to grade only new submissions to optimize things!
				});
			} else {
				next(new APIError('Wrapper not found', 422, true));
			}
		})
		.catch(next);
}

function archivewrapper(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `assessment${req.url}`,
		params: req.body,
	});
	const {
		payload: { role },
	} = req;

	if (role === 'moderator') {
		AssessmentWrapper.findOne(
			{ _id: req.params.wrapperId }, // client: client._id
			{ phases: 1, isArchived: 1 }
		).then((assessmentWrapper) => {
			if (assessmentWrapper && !assessmentWrapper.isArchived) {
				if (assessmentWrapper.phases.length) {
					res.json({ success: false, error: { code: 'phases-present' } });
				} else {
					AssessmentWrapper.update(
						{ _id: req.params.wrapperId },
						{ $set: { isArchived: true } }
					).then(() => {
						res.json({ success: true });
					});
				}
			} else {
				res.json({ success: false, error: { code: 'not-found' } });
			}
		});
	} else {
		AssessmentWrapper.findById(req.params.wrapperId, { phases: 1 }).then(
			(assessmentWrapper) => {
				if (assessmentWrapper && !assessmentWrapper.isArchived) {
					if (assessmentWrapper.phases.length) {
						res.json({ success: false, error: { code: 'phases-present' } });
					} else {
						AssessmentWrapper.update(
							{ _id: req.params.wrapperId },
							{ $set: { isArchived: true } }
						).then(() => {
							res.json({ success: true });
						});
					}
				} else {
					res.json({ success: false, error: { code: 'not-found' } });
				}
			}
		);
	}
}

function archivecore(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `assessment${req.url}`,
		params: req.body,
	});
	const {
		payload: { role, id },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	if (role === 'moderator') {
		Client.findOne({ moderators: ObjectId(id) }).then((client) => {
			if (client) {
				AssessmentCore.findById(req.params.coreId, { wrappers: 1 })
					.populate([{ path: 'wrappers.wrapper', select: 'isArchived' }])
					.then((assessmentCore) => {
						if (assessmentCore && !assessmentCore.isArchived) {
							const filteredWrappers = assessmentCore.wrappers.filter((w) => {
								if (w.wrapper.isArchived) {
									return false;
								}
								return true;
							});
							if (filteredWrappers.length) {
								res.json({ success: false, error: { code: 'wrappers-present' } });
							} else {
								AssessmentCore.update(
									{ _id: ObjectId(req.params.coreId) },
									{ $set: { isArchived: true } }
								).then(() => {
									res.json({ success: true });
								});
							}
						} else {
							res.json({ success: false, error: { code: 'not-found' } });
						}
					});
			} else {
				res.json({ success: false, error: { code: 'not-found' } });
			}
		});
	} else {
		AssessmentCore.findById(req.params.coreId, { wrappers: 1 })
			.populate([{ path: 'wrappers.wrapper', select: 'isArchived' }])
			.then((assessmentCore) => {
				if (assessmentCore && !assessmentCore.isArchived) {
					const filteredWrappers = assessmentCore.wrappers.filter((w) => {
						if (w.wrapper.isArchived) {
							return false;
						}
						return true;
					});
					if (filteredWrappers.length) {
						res.json({ success: false, error: { code: 'wrappers-present' } });
					} else {
						AssessmentCore.update(
							{ _id: ObjectId(req.params.coreId) },
							{ $set: { isArchived: true } }
						).then(() => {
							res.json({ success: true });
						});
					}
				} else {
					res.json({ success: false, error: { code: 'not-found' } });
				}
			});
	}
}

function gradeCore(req, res) {
	logger.info(
		`gradecore called with coreId ${req.params.coreId} ${req.payload.role} ${req.payload.id}`
	);
	AssessmentCore.findOne({ _id: req.params.coreId })
		.populate([
			{
				path: 'sections.questions.question',
				populate: [{ path: 'statistics' }],
			},
			{
				path: 'wrappers.wrapper',
				populate: [{ path: 'analysis', select: 'bonus' }],
			},
			{ path: 'analysis preAnalysis' },
		])
		.exec()
		.then((assessmentCore) => {
			if (assessmentCore) {
				Submission.getAllGraded(assessmentCore._id, '')
					.then((gradedSubmissions) => {
						logger.info(
							`grading ${gradedSubmissions.length} submissions core:${assessmentCore._id}`
						);
						const { stats } = reGradeCore(assessmentCore, gradedSubmissions);

						let sumPickingAbility = 0;
						let sumSqPickingAbility = 0;
						gradedSubmissions.forEach((submission) => {
							const { pickingAbility } = getPickingAbility(submission, assessmentCore);
							sumPickingAbility += pickingAbility;
							sumSqPickingAbility += pickingAbility * pickingAbility;
						});

						const coreAnalysis = assessmentCore.analysis;
						coreAnalysis.marks = stats.marks;
						coreAnalysis.hist = stats.hist;
						coreAnalysis.sections = stats.sections.map((section) => ({
							id: section.id,
							incorrect: section.incorrect,
							correct: section.correct,
							sumMarks: section.sumMarks,
							maxMarks: section.maxMarks,
							marks: section.marks,
							sumTime: section.sumTime,
							hist: section.hist,
							questions: section.questions.map((question) => ({
								id: question.id,
								sumSqTime: question.sumSqTime,
								sumTime: question.sumTime,
								times: question.times,
								correctAttempts: question.correctAttempts,
								totalAttempts: question.totalAttempts,
							})),
						}));
						coreAnalysis.difficulty = stats.difficulty;
						coreAnalysis.sumMarks = stats.sumMarks;
						coreAnalysis.maxMarks = stats.maxMarks;
						coreAnalysis.sumAccuracy = stats.sumAccuracy;
						coreAnalysis.sumSqAccuracy = stats.sumSqAccuracy;

						coreAnalysis.sumPickingAbility = sumPickingAbility;
						coreAnalysis.sumSqPickingAbility = sumSqPickingAbility;
						coreAnalysis.submissions = gradedSubmissions.map((submission) => ({
							submission: submission._id,
						}));

						coreAnalysis.totalAttempts = assessmentCore.preAnalysis
							? gradedSubmissions.length + 30
							: gradedSubmissions.length;
						coreAnalysis.lastSynced = new Date();

						coreAnalysis.markModified('marks');
						coreAnalysis.markModified('hist');
						coreAnalysis.markModified('topper');
						coreAnalysis.markModified('sections');
						coreAnalysis.markModified('difficulty');
						coreAnalysis.markModified('sumMarks');
						coreAnalysis.markModified('maxMarks');
						coreAnalysis.markModified('sumAccuracy');
						coreAnalysis.markModified('sumSqAccuracy');
						coreAnalysis.markModified('totalAttempts');
						coreAnalysis.markModified('lastSynced');
						coreAnalysis
							.save()
							.then(() => {
								assessmentCore.wrappers.forEach((w) => {
									const { wrapper } = w;
									wrapper.attemptsSynced = wrapper.totalAttempts;
									wrapper.markModified('attemptsSynced');
									wrapper.save((saveError) => {
										if (saveError) {
											const errorMessage =
												saveError && saveError.message
													? saveError.message
													: 'Error is empty';
											logger.error(
												`Failed to save wrapper in grade core; ${wrapper._id} ${errorMessage}`
											);
										}
									});
								});
								res.json({
									success: true,
									totalAttempts: coreAnalysis.totalAttempts,
									coreAnalysis,
								});
							})
							.catch((error) => {
								const errorMessage =
									error && error.message ? error.message : 'Error is empty';
								logger.error(
									`Failed to find submissions of assessment core ${assessmentCore._id}; error: ${errorMessage}`
								);
								res.status(500).send({ status: false, error: errorMessage });
							});
					})
					.catch((error) => {
						const errorMessage =
							error && error.message ? error.message : 'Error is empty';
						logger.error(
							`Failed to find submissions of assessment core ${assessmentCore._id}; error: ${errorMessage}`
						);
						res.status(500).send({ status: false, error: errorMessage });
					});
			} else {
				res.json({ success: false });
			}
		})
		.catch((error) => {
			const errorMessage =
				error && error.message ? error.message : 'Error is empty';
			logger.error(`Failed to core(outer catch) ${errorMessage}`);
			res.status(500).send({
				message: 'Failed to grade core(outer catch)',
				error: errorMessage,
			});
		});
}

function gradeSubmissions(req, res) {
	// change names of functions
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `assessment${req.url}`,
		params: req.body,
	});
	const { assessmentId } = req.body;
	// const bonusQuestions = JSON.parse(req.body.bonus);
	// bonus should also be displayed in assessment

	AssessmentWrapper.findById(assessmentId)
		.populate([
			{
				path: 'core',
				populate: [
					{
						path: 'sections.questions.question',
						populate: [{ path: 'statistics' }],
					},
					{ path: 'preAnalysis analysis' },
				],
			},
			{
				path: 'analysis',
			},
		])
		.then((assessmentWrapper) => {
			const timeNow = new Date().getTime();
			const { availableTill } = assessmentWrapper;
			if (timeNow < availableTill.getTime()) {
				// not used
				res.status(422).json({ error: { code: 'assessment-not-ended' } });
			} else if (assessmentWrapper.locked) {
				res.status(422).json({ error: { code: 'assessment-locked' } });
			} else {
				gradeSubmissionsGeneric(assessmentWrapper).then(
					({ assessmentWrapper: assessment }) => {
						// eslint-disable-next-line no-console
						console.log('all done!!');
						res.json({ success: true, assessment });
					}
				); // try to grade only new submissions to optimize things!
			}
		});
}

function markSubmissionAsNotGraded(req, res, next) {
	const { submission: submissionId } = req.query;
	Submission.findById(submissionId)
		.populate([
			{ path: 'coreAnalysis', select: 'submissions' },
			{ path: 'wrapperAnalysis', select: 'submissions' },
		])
		.then((submission) => {
			if (!submission) {
				next();
			} else {
				submission.coreAnalysis.set(
					'submissions',
					submission.coreAnalysis.submissions.filter(
						(item) => !item.submission.equals(submission._id)
					)
				);
				const initialWrapperAnalysis = submission.wrapperAnalysis.toJSON();
				submission.wrapperAnalysis.set(
					'submissions',
					submission.wrapperAnalysis.submissions.filter(
						(item) => !item.submission.equals(submission._id)
					)
				);
				submission.wrapperAnalysis.save((wSaveError) => {
					if (wSaveError) {
						next(wSaveError);
					} else {
						submission.coreAnalysis.save((saveError) => {
							if (saveError) {
								next(saveError);
							} else {
								res.send({
									success: true,
									coreAnalysis: submission.coreAnalysis,
									wrapperAnalysis: submission.wrapperAnalysis,
									initialWrapperAnalysis,
								});
							}
						});
					}
				});
			}
		});
}

function getResponseTimeCategory(response, question) {
	// confirm this from saharan
	let category = 'perfect';

	const q = get(question, 'statistics.perfectTimeLimits', null);

	if (q && q.min !== undefined) {
		if (response.time / 1000.0 < q.min) category = 'wasted';
		else if (response.time / 1000.0 > q.max) category = 'overtime';
	}
	return category;
}

function getGradedStats(submission) {
	const {
		meta: { percent, percentile, rank, marks, sections },
		flow,
		assessmentCore,
		wrapperAnalysis,
		coreAnalysis,
	} = submission;
	const ranks = getRanking(wrapperAnalysis, marks, sections);

	if (
		percent !== ranks.percent ||
		percentile !== ranks.percentile ||
		rank !== ranks.rank
	) {
		// for auto graded only!!
		submission.meta.percent = ranks.percent;
		submission.meta.percentile = ranks.percentile;
		submission.meta.rank = ranks.rank;
	}
	submission.meta.secRank = ranks.secRank;

	const submissionCopy = {};
	submissionCopy.meta = submission.meta;
	submissionCopy.response = submission.response;
	submissionCopy.flow = submission.flow;
	submissionCopy.graded = submission.graded;
	submissionCopy.live = submission.live;
	submissionCopy.createdAt = submission.createdAt;
	submissionCopy._id = submission._id;

	const timeQuestionMap = {};

	let currentTime = 0;
	let questionsSeen = 0;
	const intermediatePoints = [];
	let questionsAttempted = 0;
	const questionsAttemptedMap = {};
	const lastResponse = {};

	let offset = 0;
	const questionOffsets = assessmentCore.sections.map((s) => {
		const lastOffset = offset;
		offset += s.questions.length;
		return lastOffset;
	});

	flow.forEach((f) => {
		let skip = false;
		if (assessmentCore.sections[f.section] === undefined) {
			skip = true;
		} else if (
			assessmentCore.sections[f.section].questions[f.question] === undefined
		) {
			skip = true;
		}
		if (!skip) {
			const { question } =
				assessmentCore.sections[f.section].questions[f.question];
			const questionStats = coreAnalysis.sections[f.section].questions[f.question];
			const metaQuestion =
				submissionCopy.meta.sections[f.section].questions[f.question];
			const questionResponse =
				submissionCopy.response.sections[f.section].questions[f.question];

			let modifcation = false;
			if (lastResponse[question._id] !== f.response) modifcation = true;
			lastResponse[question._id] = f.response;

			if (timeQuestionMap[question._id] === undefined) {
				let timeToughness = 180;

				if (f.state === 3 || f.state === 4) questionsAttempted += 1;

				if (question && question.statistics && question.statistics.medianTime) {
					timeToughness = question.statistics.medianTime;
				} else if (questionStats.times.length) {
					questionStats.times.sort();
					timeToughness =
						questionStats.times[Math.floor(questionStats.times.length / 2)];
				} else if (questionStats.correctAttempts > 0) {
					timeToughness = questionStats.sumTime / questionStats.correctAttempts;
				}

				let result = 0;
				if (questionResponse.answer) {
					if (metaQuestion.correct) {
						result = 1;
					} else {
						result = -1;
					}
				}

				let accuracy = 'N/A';
				if (questionStats.totalAttempts) {
					accuracy = `${Math.round(
						(100.0 * questionStats.correctAttempts) / questionStats.totalAttempts
					)}%`;
				}
				questionsSeen += 1;

				timeQuestionMap[question._id] = {
					firstVisit: currentTime,
					lastVisit: currentTime + f.time,
					timeCategory: getResponseTimeCategory(questionResponse, question),
					timeToughness,
					topic: question.topic,
					result,
					questionsSeen,
					questionsAttempted,
					time: currentTime,
					totalTime: metaQuestion.time,
					accuracy,
					sectionName: assessmentCore.sections[f.section].name,
					questionNo: questionOffsets[f.section] + f.question + 1,
					totalVisits: 1,
					difficulty: question.level,
				};
			} else {
				// intermediatePoints

				if (
					f.lastState !== 3 &&
					f.lastState !== 4 &&
					(f.state === 3 || f.state === 4)
				) {
					questionsAttempted += 1;
				} else if (
					(f.lastState === 3 || f.lastState === 4) &&
					f.state !== 3 &&
					f.state !== 4
				) {
					questionsAttempted += 1;
				}

				intermediatePoints.push({
					firstVisit: -1,
					lastVisit: -1,
					timeCategory: 'perfect',
					timeToughness: -1,
					topic: -1,
					result: -1,
					questionsSeen,
					questionsAttempted,
					time: currentTime,
					totalTime: -1,
					accuracy: '',
					sectionName: '',
					questionNo: -1,
					totalVisits: -1,
					difficulty: -1,
				});
				if (modifcation) {
					timeQuestionMap[question._id].lastVisit = currentTime + f.time;
				}
				timeQuestionMap[question._id].totalVisits += 1;
			}
			questionsAttemptedMap[question._id] = f.state;
			currentTime += f.time; // millisecs
		}
	});

	const roadmap = Object.keys(timeQuestionMap).map((k) => ({
		firstVisit: timeQuestionMap[k].firstVisit,
		_id: k,
		timeToughness: timeQuestionMap[k].timeToughness,
		timeCategory: timeQuestionMap[k].timeCategory,
		topic: timeQuestionMap[k].topic,
		result: timeQuestionMap[k].result,
		lastVisit: timeQuestionMap[k].lastVisit,
		questionsSeen: timeQuestionMap[k].questionsSeen,
		questionsAttempted: timeQuestionMap[k].questionsAttempted,
		time: timeQuestionMap[k].firstVisit,
		totalTime: timeQuestionMap[k].totalTime,
		accuracy: timeQuestionMap[k].accuracy,
		sectionName: timeQuestionMap[k].sectionName,
		questionNo: timeQuestionMap[k].questionNo,
		totalVisits: timeQuestionMap[k].totalVisits,
		difficulty: timeQuestionMap[k].difficulty,
	}));

	intermediatePoints.forEach((ip) => {
		roadmap.push(ip);
	});

	submissionCopy.roadmap = roadmap;

	const firstSeenTime = getFirstSeenTime_(
		submission.flow,
		getTotalQuestions(assessmentCore)
	);

	const { firstSeenCorrect, firstSeenIncorrect, firstSeenSkip } =
		getFirstTimeAccuracy(assessmentCore.sections, submission.flow);

	submission.meta.firstSeenTime = firstSeenTime;
	submission.meta.firstSeenCorrect = firstSeenCorrect;
	submission.meta.firstSeenIncorrect = firstSeenIncorrect;
	submission.meta.firstSeenSkip = firstSeenSkip;

	delete submissionCopy.flow;
	return { submission: submissionCopy };
}

function getFirstSeenTime_(flow, n) {
	const questionsSeen = {};
	let sumTime = 0;

	flow.forEach((f) => {
		if (questionsSeen[`${f.section}-${f.question}`] === undefined) {
			questionsSeen[`${f.section}-${f.question}`] = f.response;
		}
		if (Object.keys(questionsSeen).length < n) {
			sumTime += f.time;
		}
	});

	if (Object.keys(questionsSeen).length < n) sumTime = -1;
	return sumTime;
}

function getGrades(req, res) {
	// we can use cache!!!
	// send total marks and maxMarks only, if assessment is not graded yet
	// check user
	// send only reports of current user
	const { submissionId, hideQuestions, fetchSubmission, user } = req.body;
	const questionProps = hideQuestions
		? 'level reports options multiOptions range integerAnswer type statistics answers'
		: 'options multiOptions range integerAnswer type content dataType link hint solution solSubmittedBy reports level statistics answers';

	let toSearch = req.payload.id;

	if (req.payload.role !== 'user') {
		toSearch = user;
	}

	if (fetchSubmission) {
		Submission.findOne({
			_id: submissionId,
			user: toSearch,
		})
			.populate([
				{ path: 'coreAnalysis' },
				{ path: 'wrapperAnalysis' },
				{ path: 'assessmentWrapper' },
				{
					path: 'assessmentCore',
					populate: [
						{
							path: 'sections.questions.question',
							select: questionProps,
							populate: [
								{ path: 'statistics' },
								{ path: 'solSubmittedBy', select: 'dp username' },
							],
						},
					],
				},
			])
			.then((submission) => {
				if (!submission) {
					res.status(422).json({ success: false });
				} else if (submission.graded) {
					const gradedSubmission = getGradedStats(submission);
					res.json({
						success: true,
						submission: gradedSubmission.submission,
						coreAnalysis: secureCoreAnalysis(submission.coreAnalysis),
						wrapperAnalysis: secureWrapperAnalysis(submission.wrapperAnalysis),
						assessmentCore: submission.assessmentCore,
						assessmentWrapper: submission.assessmentWrapper,
						bestQuestionGroupChoices:
							submission.coreAnalysis.getBestQuestionGroupChoices(
								submission.assessmentCore
							),
					});
				} else {
					const meta = gradeAllSections(
						submission.response.sections,
						submission.assessmentCore.sections,
						{},
						submission.assessmentCore.markingScheme,
						submission.assessmentCore.sectionGroups
					);
					// submission.meta = meta;
					const submissionObject = submission.toObject();
					submissionObject.meta = meta;
					res.send({
						submission: submissionObject,
						assessmentWrapper: {
							name: submission.assessmentWrapper.name,
							type: submission.assessmentWrapper.type,
							availableTill: submission.assessmentWrapper.availableTill,
						},
						coreAnalysis: { maxMarks: getMaxMarks(submission.assessmentCore) },
					});
				}
			})
			.catch((err) => {
				console.error(err);
				res.status(422).send(err);
			});
	} else {
		Submission.findOne(
			{ _id: ObjectId(submissionId), user: ObjectId(toSearch) },
			{
				coreAnalysis: 1,
				wrapperAnalysis: 1,
				assessmentWrapper: 1,
				assessmentCore: 1,
			}
		)
			.populate([
				{ path: 'coreAnalysis' },
				{ path: 'wrapperAnalysis' },
				{ path: 'assessmentWrapper' },
				{
					path: 'assessmentCore',
					populate: [
						{
							path: 'sections.questions.question',
							select: questionProps,
							populate: [{ path: 'statistics' }],
						},
					],
				},
			])
			.then((submission) => {
				if (!submission) {
					res.statius(422).json({ success: false });
				} else {
					res.json({
						success: true,
						coreAnalysis: secureCoreAnalysis(submission.coreAnalysis),
						wrapperAnalysis: secureWrapperAnalysis(submission.wrapperAnalysis),
						assessmentCore: submission.assessmentCore,
						assessmentWrapper: submission.assessmentWrapper,
					});
				}
			})
			.catch((err) => {
				// eslint-disable-next-line no-console
				console.log('check err', err);
				res.status(422).send(err);
			});
	}
}

async function getAnalysis(req, res) {
	// can use cache!!!
	// send total marks and maxMarks only, if assessment is not graded yet
	// check user //send only reports of current user
	const { wrapperId, fetchSubmission, userId } = req.body;

	if (fetchSubmission) {
		const count = await Submission.countDocuments({
			assessmentWrapper: ObjectId(wrapperId),
			user: ObjectId(userId),
		});
		Submission.findOne({
			assessmentWrapper: ObjectId(wrapperId),
			user: ObjectId(userId),
		})
			.skip(count - 1)
			.populate([
				{ path: 'coreAnalysis' },
				{ path: 'wrapperAnalysis' },
				{
					// get rid of this!
					path: 'assessmentCore',
					populate: [
						{
							path: 'sections.questions.question',
							select:
								'level reports options multiOptions range integerAnswer type statistics answers',
							populate: [{ path: 'statistics' }],
						},
					],
				},
			])
			.then((submission) => {
				if (!submission) {
					res.status(422).json({ success: false });
				} else if (submission.graded) {
					const gradedSubmission = getGradedStats(submission);
					res.json({
						success: true,
						submission: gradedSubmission.submission,
						coreAnalysis: secureCoreAnalysis(submission.coreAnalysis),
						wrapperAnalysis: secureWrapperAnalysis(submission.wrapperAnalysis),
						bestQuestionGroupChoices:
							submission.coreAnalysis.getBestQuestionGroupChoices(
								submission.assessmentCore
							),
					});
				} else {
					const meta = gradeAllSections(
						submission.response.sections,
						submission.assessmentCore.sections,
						{},
						submission.assessmentCore.markingScheme,
						submission.assessmentCore.sectionGroups
					);
					submission.meta = meta;
					res.send({
						success: true,
						submission,
						coreAnalysis: { maxMarks: getMaxMarks(submission.assessmentCore) },
					});
				}
			})
			.catch((err) => {
				res.status(422).send({
					success: false,
					message: 'Error occurred while getting Analysis',
					error: err ? err.message : 'Error is falsy. getAnalysis',
					errorStack: err ? err.stack : 'Error is falsy',
				});
			});
	} else {
		Submission.findOne(
			{ assessmentWrapper: ObjectId(wrapperId), user: ObjectId(userId) },
			{
				coreAnalysis: 1,
				wrapperAnalysis: 1,
				assessmentWrapper: 1,
				assessmentCore: 1,
			}
		)
			.populate([
				{ path: 'coreAnalysis' },
				{ path: 'wrapperAnalysis' },
				{ path: 'assessmentWrapper' },
				{
					path: 'assessmentCore',
					populate: [
						{
							path: 'sections.questions.question',
							select:
								'level reports options multiOptions range integerAnswer type statistics answers',
							populate: [{ path: 'statistics' }],
						},
					],
				},
			])
			.then((submission) => {
				if (!submission) {
					res.statius(422).json({ success: false });
				} else {
					// i think there is no requirement of assessmentCore and assessmentWrapper here!
					res.json({
						success: true,
						coreAnalysis: secureCoreAnalysis(submission.coreAnalysis),
						wrapperAnalysis: secureWrapperAnalysis(submission.wrapperAnalysis),
						assessmentCore: submission.assessmentCore,
						assessmentWrapper: submission.assessmentWrapper,
					});
				}
			})
			.catch((err) => {
				// eslint-disable-next-line no-console
				console.log('check err', err);
				res.status(422).send(err);
			});
	}
}

function questionRatingData(res) {
	res.json({ success: true });
}

function automatedAssessment(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `assessment${req.url}`,
		params: req.body,
	});
	const {
		sections,
		name,
		availableFrom,
		availableTill,
		visibleFrom,
		duration,
		autoGrade,
	} = req.body;

	const autoGradeAssessment = !!autoGrade;

	const searchQuestions = [];
	const searchLinkedQuestions = [];
	sections.forEach((sec) => {
		sec.questions.forEach((t) => {
			let found = false;
			searchQuestions.forEach((sq) => {
				if (
					sq.sub_topic === t.sub_topic &&
					t.type === 'MULTIPLE_CHOICE_SINGLE_CORRECT' &&
					t.level === sq.level
				) {
					sq.count += t.count;
					found = true;
				}
			});
			if (!found) {
				searchQuestions.push({
					sub_topic: t.sub_topic,
					count: t.count,
					level: t.level,
				});
			}

			found = false;
			searchLinkedQuestions.forEach((sq) => {
				// level not integrated yet!!
				if (
					sq.sub_topic === t.sub_topic &&
					t.type === 'LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT' &&
					t.count === sq.questions
				) {
					sq.count += 1;
					found = true;
				}
			});
			if (!found) {
				searchLinkedQuestions.push({
					sub_topic: t.sub_topic,
					count: 1,
					questions: t.count,
				});
			}
		});
	});

	Question.searchQuestions(searchQuestions).then((questions) => {
		let errorFound = false;
		questions.forEach((q) => {
			if (!errorFound && q.error) {
				errorFound = true;
				res.json(q);
			}
		});
		if (errorFound) return;
		const sections_ = sections.map((sec) => {
			const questions_ = [];
			sec.questions.forEach((t) => {
				if (t.type === 'MULTIPLE_CHOICE_SINGLE_CORRECT') {
					const result = selectQuestions(questions, t.count, t.sub_topic, t.level);
					result.selected.forEach((s) => {
						questions_.push({
							question: s._id,
							topic: s.topic,
							sub_topic: s.sub_topic,
							level: s.level, // we don't store level!!
						});
					});
					questions = result.remaining;
				} else {
					// not complete yet!!
				}
			});
			const shuffledQuestions = shuffle(questions_);
			return { name: sec.name, questions: shuffledQuestions };
		});

		const draft = new Draft({
			name,
			availableFrom: new Date(availableFrom),
			availableTill: new Date(availableTill),
			visibleFrom: new Date(visibleFrom),
			duration: parseInt(duration, 10),
			sections: sections_,
			autoGrade: autoGradeAssessment,
		});

		draft.save().then((savedDraft) => {
			res.json({ success: true, draft: savedDraft });
		});
	});
}

function update(req, res) {
	// only marks update is allowed!!
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `assessment${req.url}`,
		params: req.body,
	});
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}
	let { sections } = req.body;
	const { id } = req.body;
	sections = JSON.parse(sections);
	AssessmentCore.findById(id)
		.exec()
		.then((assessmentCore) => {
			sections.forEach((sec) => {
				let found = -1;
				assessmentCore.sections.forEach((s, idx) => {
					if (toString(s._id) === toString(sec._id)) found = idx;
				});
				if (found === -1) {
					// eslint-disable-next-line no-console
					console.log('errr!!!');
				} else {
					sec.questions.forEach((q, idx) => {
						assessmentCore.sections[found].questions[idx].correctMark = q.correctMark;
						assessmentCore.sections[found].questions[idx].incorrectMark =
							q.incorrectMark;
					});
				}
			});

			assessmentCore.set('instructions', generateInstructions(assessmentCore));

			assessmentCore.markModified('sections');
			assessmentCore.markModified('instructions');
			assessmentCore.save().then(() => {
				res.json({
					success: true,
					assessmentCore,
					i: generateInstructions(assessmentCore),
				});
			});
		});
}

function initializePreAnalysis(sections) {
	const stats = {};
	stats.marks = [0, 0, 0, 0, 0, 0];
	stats.sumAccuracy = 0;
	stats.sumSqAccuracy = 0;
	stats.sections = sections.map((s) => ({
		id: s._id,
		incorrect: 0,
		correct: 0,
		sumTime: 0,
		questions: s.questions.map((q) => ({
			id: q.question,
			sumSqTime: 0,
			sumTime: 0,
			times: [],
			correctAttempts: 0,
			totalAttempts: 0,
		})),
	}));
	return stats;
}

function recalculatePreAnalysis(preAnalysis, sections) {
	let sumAttemptRate = 0;
	let sumAccuracy = 0;
	sections.forEach((s, i) => {
		let correct = 0;
		let incorrect = 0;
		let sumTimeSec = 0;
		preAnalysis.stats.sections[i].times = [];

		s.questions.forEach((q, j) => {
			const attemptRate = parseFloat(q.attemptRate, 10) / 100.0;
			const accuracy = parseFloat(q.accuracy, 10) / 100.0;
			const averageTime = parseFloat(q.averageTime, 10);
			const correctAttempts = Math.ceil(30 * attemptRate * accuracy);
			const totalAttempts = Math.ceil(30 * attemptRate);
			const sumTime = correctAttempts * averageTime;
			const sumSqTime = correctAttempts
				? (sumTime * sumTime * (1 + attemptRate * accuracy)) / correctAttempts
				: 0;

			correct += correctAttempts;
			incorrect += totalAttempts - correctAttempts;
			sumTimeSec += sumTime;

			sumAttemptRate += attemptRate;
			sumAccuracy += accuracy;

			preAnalysis.stats.sections[i].questions[j].sumTime = sumTime;
			preAnalysis.stats.sections[i].questions[j].times = [];
			for (let ii = 0; ii < correctAttempts; ii += 1) {
				preAnalysis.stats.sections[i].questions[j].times.push(averageTime);
			}
			preAnalysis.stats.sections[i].questions[j].sumSqTime = sumSqTime;
			preAnalysis.stats.sections[i].questions[j].correctAttempts = correctAttempts;
			preAnalysis.stats.sections[i].questions[j].totalAttempts = totalAttempts;
		});
		preAnalysis.stats.sections[i].correct = correct;
		preAnalysis.stats.sections[i].incorrect = incorrect;
		preAnalysis.stats.sections[i].sumTime = sumTimeSec;
		for (let ii = 0; ii < 30; ii += 1) {
			preAnalysis.stats.sections[i].times.push(sumTimeSec / 30.0);
		}
	});

	preAnalysis.stats.sumAccuracy = sumAccuracy;

	preAnalysis.stats.sumSqAccuracy =
		(sumAccuracy * sumAccuracy * (1 + sumAttemptRate / 30.0)) / 30;

	preAnalysis.markModified('stats');
	preAnalysis.save();
}

function updatePreAnalysis(req, res) {
	// only marks update is allowed!!
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `assessment${req.url}`,
		params: req.body,
	});
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}
	let { preAnalysisStats } = req.body;
	const { id } = req.body;
	preAnalysisStats = JSON.parse(preAnalysisStats);
	AssessmentCore.findById(id)
		.exec()
		.then((assessmentCore) => {
			if (assessmentCore) {
				if (!assessmentCore.preAnalysis) {
					const stats = initializePreAnalysis(assessmentCore.sections);
					const preanalysis = new PreAnalysis({
						assessmentCore: assessmentCore._id,
						stats,
					});
					preanalysis.save().then((savedPreAnalysis) => {
						assessmentCore.set('preAnalysis', savedPreAnalysis);
						assessmentCore.save();
						res.json({ success: true });
					});
				} else {
					PreAnalysis.findOne({ _id: assessmentCore.preAnalysis }).then(
						(preAnalysis) => {
							recalculatePreAnalysis(preAnalysis, preAnalysisStats);
							res.json({ success: true });
						}
					);
				}
			} else {
				res.json({ success: false });
			}
		});
}

function updateDates(req, res, next) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `assessment${req.url}`,
		params: req.body,
	});
	const { id, availableFrom, availableTill, visibleFrom, expiresOn } = req.body;
	AssessmentWrapper.findById(id)
		.exec()
		.then((assessmentWrapper) => {
			if (!assessmentWrapper) {
				next(new APIError('Assessment not found', 404));
			} else {
				if (availableFrom) {
					assessmentWrapper.set('availableFrom', availableFrom);
				}
				if (availableTill) {
					assessmentWrapper.set('availableTill', availableTill);
				}
				if (visibleFrom) {
					assessmentWrapper.set('visibleFrom', visibleFrom);
				}
				if (expiresOn) {
					assessmentWrapper.set('expiresOn', expiresOn);
				}
				assessmentWrapper.save().then(() => {
					res.json({});
					const phases = concat(
						assessmentWrapper.permissions
							.filter((p) => p.itemType === 'Phase')
							.map((p) => p.item),
						assessmentWrapper.phases.map((p) => p.phase)
					);
					clearPhaseWrapperCache(phases);
				});
			}
		})
		.catch(next);
}

function renameWrappers(wrappers, phase) {
	wrappers.forEach((wrapper) => {
		let newname = wrapper.name;
		let newslang = wrapper.slang;
		let newavailablefrom = wrapper.availableFrom;
		let newexpireson = wrapper.expiresOn;
		wrapper.phases.forEach((p) => {
			if (p.phase.toString() === phase) {
				if (p.name) newname = p.name;
				if (p.slang) newslang = p.slang;
				if (p.availableFrom) newavailablefrom = p.availableFrom;
				if (p.expiresOn) newexpireson = p.expiresOn;
			}
		});
		wrapper.name = newname;
		wrapper.slang = newslang;
		wrapper.availableFrom = newavailablefrom;
		wrapper.expiresOn = newexpireson;
	});
	return wrappers;
}

const getwrappers = async (req, res) => {
	const { phase } = req.params;
	const today = new Date();
	const phases = [phase];
	const userToSearch =
		req.payload.role === 'parent' ? req.query.userId : req.payload.id;
	const user = await User.findById(userToSearch).select('oldPhases');
	if (!user) return res.send({ success: false, msg: 'User not found!' });
	forEach(get(user, 'oldPhases', []), (value) => {
		phases.push(value);
	});
	const services = [];
	const service = await ServicePlan.find({
		'visibleIn.value': { $in: phases },
	});
	service.forEach((value) => {
		value.services.forEach((val) => {
			services.push(val);
		});
	});
	AssessmentWrapper.find(
		{
			$or: [
				{
					'phases.phase': { $in: phases },
					visibleFrom: { $lte: today },
				},
				{
					visibleForServices: { $in: services },
					visibleFrom: { $lte: today },
				},
			],
		},
		{
			core: 1,
			name: 1,
			slang: 1,
			type: 1,
			topic: 1,
			section: 1,
			label: 1,
			availableFrom: 1,
			availableTill: 1,
			visibleFrom: 1,
			expiresOn: 1,
			graded: 1,
			cost: 1,
			reward: 1,
			phases: 1, // ??
			description: 1,
			comps: 1,
			messages: 1,
			difficulty: 1,
			visibleForServices: 1,
			series: 1,
			tags: 1,
			onlyCBT: 1,
		}
	)
		.populate([
			{
				path: 'core',
				select:
					'instructions syllabus duration sectionInstructions customInstructions customSyllabus',
			},
		])
		.then((assessmentWrappers) => {
			res.set('Cache-Control', 'public, s-maxage=600');
			const renamedWrappers = renameWrappers(assessmentWrappers, phase);
			res.json({
				success: true,
				assessmentWrappers: renamedWrappers,
			});
		})
		.catch((e) => {
			res.status(422).json({ success: false, e });
		});
};

const getwrapper = (req, res) => {
	const { wrapperId } = req.params;
	AssessmentWrapper.findById(wrapperId, {
		core: 1,
		name: 1,
		type: 1,
		availableTill: 1,
		messages: 1,
		description: 1,
		comps: 1,
		phases: 1,
		hideResults: 1,
		hideDetailedAnalysis: 1,
	})
		.populate([
			{
				path: 'core',
				select: '_id duration sections preAnalysis',
			},
		])
		.then((assessmentWrapper) => {
			res.set('Cache-Control', 'public, s-maxage=3600');
			res.json({
				success: true,
				assessmentWrapper,
				assessmentCore: assessmentWrapper.core,
			});
		})
		.catch((e) => {
			res.json({ success: false, e });
		});
};

const getwrappertoppers = (req, res) => {
	const { wrapperId } = req.params;
	AssessmentWrapper.findOne(
		{
			_id: wrapperId,
		},
		{
			analysis: 1,
		}
	)
		.populate([
			{
				path: 'analysis',
				select: 'marks',
			},
		])
		.then((assessmentWrapper) => {
			if (assessmentWrapper) {
				const select = Math.min(
					10 * Math.round(assessmentWrapper.analysis.marks.length / 100),
					50
				);

				const toppers = assessmentWrapper.analysis.marks
					.sort((a, b) => {
						if (a.marks > b.marks) return -1;
						if (a.marks < b.marks) return 1;
						return 0;
					})
					.splice(0, select);

				const topperIds = toppers.map((t) => t.user);
				User.find({ _id: { $in: topperIds } }, { _id: 1, username: 1, dp: 1 }).then(
					(users) => {
						const userMap = {};
						users.forEach((u) => {
							userMap[u._id.toString()] = u;
						});
						const data = toppers.map((t, i) => ({
							user: {
								username: userMap[t.user] ? userMap[t.user].username : 'Prepseed-User',
								dp: userMap[t.user] ? userMap[t.user].dp : '',
								rank: i + 1,
							},
							marks: t.marks,
						}));
						res.set('Cache-Control', 'public, s-maxage=3600');
						res.json({ success: true, toppers: data });
					}
				);
			} else {
				res.json({ success: false });
			}
		});
};

const getsubmissions = (req, res) => {
	const {
		payload: { id, role },
		body: { wrapperIds, userId },
	} = req;
	let userToSearch = id;
	if (role === 'parent') {
		userToSearch = userId;
	}
	Submission.find(
		{ user: userToSearch, assessmentWrapper: { $in: wrapperIds } },
		{ assessmentWrapper: 1, graded: 1, createdAt: 1, live: 1 }
	)
		.then((submissions) => {
			const submissionMap = {};
			submissions.forEach((s) => {
				submissionMap[`${s.assessmentWrapper}`] = s;
			});

			res.json({
				success: true,
				submissionMap,
			});
		})
		.catch(() => {
			res.json({ success: false });
		});
};

function getCommonPhases(userPhases, assessmentWrapperPhases) {
	const commonPhases = [];
	const userPhasesMap = {};
	userPhases.forEach((up) => {
		userPhasesMap[up] = true;
	});
	assessmentWrapperPhases.forEach((phase) => {
		if (userPhasesMap[phase.phase]) {
			commonPhases.push(phase.phase);
		}
	});
	return commonPhases;
}

function migrateleaderboard2(res) {
	Submission.find({ graded: true })
		// .limit(10)
		.populate('assessmentWrapper user')
		.then((submissions) => {
			const leaderboards = {};
			submissions.forEach((submission) => {
				const phases = getCommonPhases(
					getActivePhasesFromSubscriptions(submission.user.subscriptions),
					submission.assessmentWrapper.phases
				);
				phases.forEach((phase) => {
					if (!leaderboards[phase]) {
						leaderboards[phase] = {
							phase,
							assessments: [],
							ratings: [],
							updatesRemaining: [],
							lastSynced: new Date(),
						};
					}
					let found = -1;
					let found2 = false;
					leaderboards[phase].assessments.forEach((assessment, idx) => {
						if (
							assessment.wrapper.toString() ===
							submission.assessmentWrapper._id.toString()
						) {
							found = idx;
							assessment.submissions.forEach((s) => {
								if (s.submission.toString() === submission._id.toString()) {
									found2 = true;
								}
							});
						}
					});
					if (!found2) {
						if (found === -1) {
							leaderboards[phase].assessments.push({
								wrapper: submission.assessmentWrapper._id,
								assessmentType: submission.assessmentWrapper.type,
								submissions: [],
							});
							found = leaderboards[phase].assessments.length - 1;
						}
						leaderboards[phase].assessments[found].submissions.push({
							submission: submission._id,
							user: submission.user._id,
							marks: submission.meta.marks,
						});
						leaderboards[phase].updatesRemaining.push({
							wrapper: submission.assessmentWrapper._id,
							submission: submission._id,
						});
					}
				});
			});

			Object.keys(leaderboards).forEach((k) => {
				const leaderboard = new Leaderboard(leaderboards[k]);
				leaderboard.save().then(() => {
					//
				});
			});

			res.json({ success: true });
		});
}

function generateSyllabus2(core) {
	// also in draft. move it somewhere else
	const syllabus = {}; // sort syllabus alphabatically!!!
	core.sections.forEach((section) => {
		section.questions.forEach((question) => {
			if (!syllabus[question.question.topic]) {
				syllabus[question.question.topic] = [];
			}
			if (
				syllabus[question.question.topic].indexOf(question.question.sub_topic) ===
				-1
			) {
				syllabus[question.question.topic].push(question.question.sub_topic);
			}
		});
	});

	return Object.keys(syllabus).map((key) => ({
		id: key,
		subTopics: syllabus[key].map((st) => ({ id: st })),
	}));
}

function fixsyllabus(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `assessment${req.url}`,
		params: req.body,
	});
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}

	AssessmentCore.findOne({ _id: req.params.coreId })
		.populate([
			{
				path: 'sections.questions.question',
				select: 'topic sub_topic',
			},
		])
		.then((assessmentCore) => {
			if (assessmentCore) {
				const syllabus = generateSyllabus2(assessmentCore);
				assessmentCore.syllabus.topics = syllabus;
				assessmentCore.sections.forEach((s) => {
					s.questions.forEach((q) => {
						q.topic = q.question.topic;
						q.sub_topic = q.question.sub_topic;
					});
				});
				assessmentCore.markModified('sections');
				assessmentCore.markModified('syllabus');
				assessmentCore
					.save()
					.then(() => {
						res.json({ success: true, syllabus: { topics: syllabus } });
					})
					.catch((err) => {
						res.json({ success: false, c: 1, err });
					});
			} else {
				res.json({ success: false, c: 2 });
			}
		})
		.catch((err) => {
			res.json({ success: false, c: 3, err });
		});
}

function getPhaseName(subscriptions) {
	let phaseName = '';
	subscriptions.forEach((group) => {
		group.subgroups.forEach((subgroup) => {
			subgroup.phases.forEach((phase) => {
				if (phase.active) {
					phaseName = phase.phase.name;
				}
			});
		});
	});
	return phaseName;
}

function getmarks(req, res, next) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}
	try {
		AssessmentWrapper.findOne({ _id: req.params.wrapperId }, { core: 1 })
			.populate({ path: 'core', select: 'sections sectionGroups' })
			.then((assessmentWrapper) => {
				if (!assessmentWrapper || !assessmentWrapper.core) {
					next(new APIError('Wrapper not found', 422, true));
				} else {
					const maxMarks = getMaxMarks(assessmentWrapper.core);
					Submission.find(
						{ assessmentWrapper: req.params.wrapperId, graded: true },
						{ user: 1, meta: 1, createdAt: 1 }
					)
						.populate([
							{
								path: 'user',
								select: '_id username email mobileNumber subscriptions',
								populate: [
									{ path: 'subscriptions.subgroups.phases.phase', select: 'name' },
								],
							},
						])
						.then((submissions) => {
							if (submissions && submissions.length && submissions.length > 0) {
								const rows = [
									[
										'Submitted On',
										'Username',
										'Email',
										'Mobile Number',
										'Phase',
										'Attempted Questions',
										'Correct Questions',
										'Incorrect Questions ',
										'Marks Gained',
										'Marks Lost',
										'Actual Marks',
									],
								];
								submissions[0].meta.sections.forEach((s, key) => {
									rows[0].push(
										`${s.name ? s.name : `Section ${key + 1}`} Positive marks`
									);
									rows[0].push(
										`${s.name ? s.name : `Section ${key + 1}`} Negative marks`
									);
									rows[0].push(`${s.name ? s.name : `Section ${key + 1}`} Total marks`);
								});
								rows[0].push('Total Marks');
								rows[0].push('Max Marks');
								submissions.forEach((s) => {
									console.log('in submission');
									const phaseName = getPhaseName(s.user.subscriptions);
									const row = [
										dayjs(s.createdAt).format('ddd, MMM D, YYYY h:mm A').toString(),
										s.user.username,
										s.user.email,
										s.user.mobileNumber,
										phaseName,
										s.meta.questionsAttempted,
										s.meta.correctQuestions,
										s.meta.incorrectQuestions,
										s.meta.marks - s.meta.marksLost,
										s.meta.marksLost,
										s.meta.marks,
									];
									s.meta.sections.forEach((ss) => {
										let positiveMarks = 0;
										let negativeMarks = 0;
										ss.questions.forEach((que) => {
											if (que.mark >= 0) {
												positiveMarks += que.mark;
											} else {
												negativeMarks += que.mark;
											}
										});
										row.push(positiveMarks);
										row.push(negativeMarks);
										row.push(positiveMarks + negativeMarks);
									});
									row.push(s.meta.marks);
									row.push(maxMarks);
									rows.push(row);
								});
								res.json({ success: true, csv: convertArrayToCSV(rows) });
							} else {
								res.json({ success: false });
							}
						})
						.catch(next);
				}
			})
			.catch(next);
	} catch (err) {
		sendEmail({
			subject: 'Get marks error',
			to: 'neel@prepseed.com',
			from: 'help@prepseed.com',
			body: err,
			bodyType: 'text',
		});
		res.json({ success: false });
	}
}

function updateBonus(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super' && role !== 'admin' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	const { wrapperAnalysis, qid, bonus, bonusDate } = req.body;

	WrapperAnalysis.findById(wrapperAnalysis)
		.populate([{ path: 'core', select: 'analysis' }])
		.then((wA) => {
			if (wA) {
				if (bonus) {
					if (!wA.bonus) wA.bonus = {};
					wA.bonus[qid] = bonusDate;
				} else {
					if (!wA.bonus) wA.bonus = {};
					delete wA.bonus[qid];
				}
				wA.submissions = [];
				wA.markModified('bonus');
				wA.markModified('submissions');
				wA.save().then(() => {
					CoreAnalysis.update(
						{ _id: wA.core.analysis },
						{ $set: { submissions: [] } }
					)
						.then(() => {
							res.json({ success: true });
						})
						.catch(() => {
							res.json({ success: false });
						});
				});
			} else {
				res.json({ success: false });
			}
		})
		.catch(() => {
			res.json({ success: false });
		});
}

const numbersText = [
	'ONE',
	'TWO',
	'THREE',
	'FOUR',
	'FIVE',
	'SIX',
	'SEVEN',
	'EIGHT',
	'NINE',
	'TEN',
	'ELEVEN',
	'TWELVE',
	'THIRTEEN',
	'FOURTEEN',
	'FIFTEEN',
	'SIXTEEN',
	'SEVENTEEN',
	'EIGHTEEN',
	'NINETEEN',
	'TWENTY',
	'TWENTY ONE',
	'TWENTY TWO',
	'TWENTY THREE',
	'TWENTY FOUR',
	'TWENTY FIVE',
];

function generateSectionInstructions(instructions) {
	const sectionInstructions = [];
	instructions.forEach((instruction, i) => {
		let prefix = 'Next';
		if (i === 0) {
			prefix = 'First';
		} else if (i === instructions.length - 1) {
			prefix = 'Last';
		}
		if (instruction.type === 'SCQ') {
			sectionInstructions.push({
				text: `${prefix} ${
					numbersText[parseInt(instruction.number, 10) - 1]
				} questions of each section have four options, out of which ONLY ONE is correct. For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'MCQP') {
			// with partial
			sectionInstructions.push({
				text: `${prefix} ${
					numbersText[parseInt(instruction.number, 10) - 1]
				} questions, each of which has four options. ONE OR MORE THAN ONE of these four options is (are) correct option(s). For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'MCQ') {
			sectionInstructions.push({
				text: `${prefix} ${
					numbersText[parseInt(instruction.number, 10) - 1]
				} questions, each of which has four options. ONE OR MORE THAN ONE of these four options is (are) correct option(s). For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'N') {
			sectionInstructions.push({
				text: `${prefix} ${
					numbersText[parseInt(instruction.number, 10) - 1]
				} questions of each section has NUMERICAL VALUE as answer. If the numerical value has more than two decimal places, truncate/round-off the value to TWO decimal places. For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'C2') {
			sectionInstructions.push({
				text: `Next part contains ${
					numbersText[parseInt(instruction.number, 10) / 2 - 1]
				} paragraphs each having TWO questions. Each question has four options, out of which ONLY ONE is correct. For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'C3') {
			sectionInstructions.push({
				text: `Next part contains ${
					numbersText[parseInt(instruction.number, 10) / 3 - 1]
				} paragraphs each having THREE questions. Each question has four options, out of which ONLY ONE is correct. For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'C4') {
			sectionInstructions.push({
				text: `Next part contains ${
					numbersText[parseInt(instruction.number, 10) / 4 - 1]
				} paragraphs each having FOUR questions. Each question has four options, out of which ONLY ONE is correct. For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'C2M') {
			sectionInstructions.push({
				text: `Next part contains ${
					numbersText[parseInt(instruction.number, 10) / 2 - 1]
				} paragraphs each having TWO questions. Each question has four options. ONE OR MORE THAN ONE of these four options is (are) correct option(s). For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'C3M') {
			sectionInstructions.push({
				text: `Next part contains ${
					numbersText[parseInt(instruction.number, 10) / 3 - 1]
				} paragraphs each having THREE questions. Each question has four options. ONE OR MORE THAN ONE of these four options is (are) correct option(s). For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'C4M') {
			sectionInstructions.push({
				text: `Next part contains ${
					numbersText[parseInt(instruction.number, 10) / 4 - 1]
				} paragraphs each having FOUR questions. Each question has four options. ONE OR MORE THAN ONE of these four options is (are) correct option(s). For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'C2N') {
			sectionInstructions.push({
				text: `Next part contains ${
					numbersText[parseInt(instruction.number, 10) / 2 - 1]
				} paragraphs each having TWO questions. Each question has NUMERICAL VALUE as answer. If the numerical value has more than two decimal places, truncate/round-off the value to TWO decimal places. For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'C3N') {
			sectionInstructions.push({
				text: `Next part contains ${
					numbersText[parseInt(instruction.number, 10) / 3 - 1]
				} paragraphs each having THREE questions. Each question has NUMERICAL VALUE as answer. If the numerical value has more than two decimal places, truncate/round-off the value to TWO decimal places. For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'C4N') {
			sectionInstructions.push({
				text: `Next part contains ${
					numbersText[parseInt(instruction.number, 10) / 4 - 1]
				} paragraphs each having FOUR questions. Each question has NUMERICAL VALUE as answer. If the numerical value has more than two decimal places, truncate/round-off the value to TWO decimal places. For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		} else if (instruction.type === 'MLIST') {
			sectionInstructions.push({
				text: `${prefix} ${
					numbersText[parseInt(instruction.number, 10) - 1]
				} questions of each section has matching lists. The codes for the lists have choices (A), (B), (C) and (D) out of which ONLY ONE is correct. For each of these question, marks will be awarded in one of the following categories:`,
				markingScheme: [],
			});
		}

		const { marking } = instruction;

		if (marking.scheme === 'partial') {
			sectionInstructions[i].markingScheme.push({
				text: `Full Marks : +${marking.positive} If only (all) the correct option(s) is (are) chosen.`,
			});

			if (marking.positive - 1 > 0) {
				sectionInstructions[i].markingScheme.push({
					text: `Partial Marks : +${
						marking.positive - 1
					} If all four options are correct but ONLY three correct options are chosen.`,
				});
			}
			if (marking.positive - 2 > 0) {
				sectionInstructions[i].markingScheme.push({
					text: `Partial Marks : +${
						marking.positive - 2
					} If three or more options are correct but ONLY two correct options are chosen.`,
				});
			} else if (marking.positive - 1 > 0) {
				sectionInstructions[i].markingScheme.push({
					text: `Partial Marks : +${
						marking.positive - 1
					} If three or more options are correct but ONLY two correct options are chosen.`,
				});
			} else {
				sectionInstructions[i].markingScheme.push({
					text: `Partial Marks : ${marking.negative} If three or more options are correct but ONLY two correct options are chosen.`,
				});
			}
			if (marking.positive - 3 > 0) {
				sectionInstructions[i].markingScheme.push({
					text: `Partial Marks : +${
						marking.positive - 3
					} If two or more options are correct but ONLY one correct option is chosen.`,
				});
			} else if (marking.positive - 2 > 0) {
				sectionInstructions[i].markingScheme.push({
					text: `Partial Marks : +${
						marking.positive - 2
					} If two or more options are correct but ONLY one correct option is chosen.`,
				});
			} else if (marking.positive - 1 > 0) {
				sectionInstructions[i].markingScheme.push({
					text: `Partial Marks : +${
						marking.positive - 1
					} If two or more options are correct but ONLY one correct option is chosen.`,
				});
			} else {
				sectionInstructions[i].markingScheme.push({
					text: `Partial Marks : ${marking.negative} If two or more options are correct but ONLY one correct option is chosen.`,
				});
			}
			sectionInstructions[i].markingScheme.push({
				text:
					'Zero Marks : 0 If none of the options is chosen (i.e. the question is unanswered).',
			});
			if (marking.negative) {
				sectionInstructions[i].markingScheme.push({
					text: `Negative Marks : ${marking.negative} In all other cases.`,
				});
			}
		} else {
			sectionInstructions[i].markingScheme.push({
				text: `Full Marks : +${marking.positive} If only the option corresponding to the correct answer is selected.`,
			});
			if (marking.negative) {
				sectionInstructions[i].markingScheme.push({
					text: `Negative Marks : ${marking.negative} If any of the option corresponding to the incorrect answer is selected`,
				});
			}
			sectionInstructions[i].markingScheme.push({
				text: 'Zero Marks : 0 If none of the options is selected.',
			});
		}
	});
	return sectionInstructions;
}

function updateSectionInstructions(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super' && role !== 'admin' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	const { instructions, coreId } = req.body;

	AssessmentCore.findOne({ _id: coreId })
		.then((assessmentCore) => {
			if (assessmentCore) {
				const sectionInstructions = generateSectionInstructions(instructions);
				assessmentCore.sectionInstructions = sectionInstructions;
				assessmentCore.markModified('sectionInstructions');
				assessmentCore.save().then(() => {
					res.json({ success: true, sectionInstructions });
				});
			} else {
				res.json({ success: false });
			}
		})
		.catch(() => {
			res.json({ success: false });
		});
}

function updateCustomSyllabus(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super' && role !== 'admin' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	const { syllabus, coreId } = req.body;

	AssessmentCore.findOne({ _id: coreId })
		.then((assessmentCore) => {
			if (assessmentCore) {
				assessmentCore.customSyllabus = syllabus;
				assessmentCore.markModified('customSyllabus');
				assessmentCore.save().then(() => {
					res.json({ success: true, customSyllabus: syllabus });
				});
			} else {
				res.json({ success: false });
			}
		})
		.catch(() => {
			res.json({ success: false });
		});
}

function upadteDuration(req, res, next) {
	const { duration, coreId } = req.body;
	AssessmentCore.findOne({ _id: coreId })
		.then((assessmentCore) => {
			if (!assessmentCore) {
				next(new APIError('', 404));
			} else {
				assessmentCore.set('duration', duration);
				assessmentCore.save((saveError) => {
					if (saveError) {
						next(saveError);
					} else {
						res.send({ message: 'Duration updated' });
					}
				});
			}
		})
		.catch(next);
}

function updateIdentifier(req, res, next) {
	const { identifier, coreId } = req.body;
	if (!identifier || !identifier.trim()) {
		next(new APIError('Identifier can not be empty', 422, true));
		return;
	}
	AssessmentCore.findOne({ _id: coreId })
		.then((assessmentCore) => {
			if (!assessmentCore) {
				next(new APIError('', 404));
			} else {
				assessmentCore.set('identifier', identifier);
				assessmentCore.save((saveError) => {
					if (saveError) {
						next(saveError);
					} else {
						res.send({ message: 'Identifier updated' });
					}
				});
			}
		})
		.catch(next);
}

function updateSectionNames(req, res) {
	const { sectionNames, coreId } = req.body;

	AssessmentCore.findOne({ _id: coreId })
		.then((assessmentCore) => {
			if (assessmentCore) {
				if (assessmentCore.sections.length !== sectionNames.length) {
					res.json({ success: false });
				} else {
					sectionNames.forEach((sN, i) => {
						assessmentCore.sections[i].name = sN;
					});
					assessmentCore.markModified('sections');
					assessmentCore.save().then(() => {
						res.json({ success: true });
					});
				}
			} else {
				res.json({ success: false });
			}
		})
		.catch(() => {
			res.json({ success: false });
		});
}

function updateGradeTime(req, res) {
	const { wrapperId, setGradeTime, gradeTime } = req.body;
	if (!setGradeTime) {
		GradeTime.remove({ wrapper: ObjectId(wrapperId) }).then((n) => {
			if (n.deletedCount) {
				res.json({ success: true, msg: 'Grade time removed successfully.', n });
			} else {
				res.json({ success: true, msg: 'No grade time was set.', n });
			}
		});
	} else {
		GradeTime.findOne({ wrapper: ObjectId(wrapperId) }).then((gt) => {
			if (gt) {
				gt.time = gradeTime;
				gt.graded = false;
				gt.markModified('time');
				gt.markModified('graded');
				gt.save().then(() => {
					res.json({ success: true, msg: 'Grade time updated successfully.' });
				});
			} else {
				const gt_ = new GradeTime({
					wrapper: ObjectId(wrapperId),
					time: gradeTime,
				});
				gt_.save().then(() => {
					res.json({ success: true, msg: 'Grade time set successfully.' });
				});
			}
		});
	}
}

function resetWrapperAnalysis(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'super' && role !== 'admin' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	const { wrapperId } = req.params;
	AssessmentWrapper.findOne({ _id: ObjectId(wrapperId) }, { analysis: 1 }).then(
		(wrapper) => {
			if (wrapper) {
				WrapperAnalysis.findById(wrapper.analysis)
					.populate([{ path: 'core', select: 'analysis' }])
					.then((wA) => {
						if (wA) {
							wA.submissions = [];
							wA.markModified('submissions');
							wA.save().then(() => {
								CoreAnalysis.update(
									{ _id: wA.core.analysis },
									{ $set: { submissions: [] } }
								)
									.then(() => {
										res.json({ success: true });
									})
									.catch(() => {
										res.json({ success: false });
									});
							});
						} else {
							res.json({ success: false });
						}
					})
					.catch(() => {
						res.json({ success: false });
					});
			} else {
				res.json({ success: false });
			}
		}
	);
}

function updateClient(req, res) {
	const { coreId, clientId } = req.body;
	AssessmentCore.update({ _id: coreId }, { $set: { client: clientId } }).then(
		(m) => {
			if (m.nModified) {
				res.json({ success: true });
			} else {
				res.json({ success: false });
			}
		}
	);
}

function updateServices(req, res) {
	const { wrapper, services } = req.body;
	const { phases } = res.locals;

	// write middleware to validate if assessmentwrapper and services are valid!!

	const serviceIds = services.map((service) => service);

	AssessmentWrapper.update(
		{ _id: wrapper, 'phases.phase': { $in: phases } },
		{ $set: { visibleForServices: serviceIds } }
	).then(() => {
		res.json({ success: true });
	});
}

function updatePrequelAndSequel(req, res, next) {
	const { prequel: prequelId, sequel: sequelId } = req.body;
	if (!prequelId || !sequelId) {
		if (!prequelId && !sequelId) {
			next(
				new APIError('Please provide at least one of prequel or sequel', 422, true)
			);
		} else {
			const wrapperId = prequelId || sequelId;
			/**
			 * what property needs to be removed
			 * so if prequelId is provided, it means that sequel of that wrapper should be null
			 * */
			const propertyToRemove = !prequelId ? 'prequel' : 'sequel';
			const propertyToRemoveOfLinkedWrapper =
				propertyToRemove === 'prequel' ? 'sequel' : 'prequel';
			AssessmentWrapper.findOne({ _id: wrapperId })
				.select(propertyToRemove)
				.populate({
					path: propertyToRemove,
					select: propertyToRemoveOfLinkedWrapper,
				})
				.then((wrapper) => {
					const linkedWrapperCleanupPromise = new Promise((resolve, reject) => {
						if (!wrapper[propertyToRemove]) {
							resolve();
						} else {
							wrapper[propertyToRemove].set(propertyToRemoveOfLinkedWrapper, null);
							wrapper[propertyToRemove].save().then(resolve).catch(reject);
						}
					});
					linkedWrapperCleanupPromise
						.then(() => {
							wrapper.set(propertyToRemove, null);
							wrapper
								.save()
								.then(() => {
									res.send({ message: `${propertyToRemove} unlinked.` });
								})
								.catch(() => {
									next(
										new APIError(
											'Cleaned up linked assessment wrapper but could not clean the source wrapper.',
											500,
											true
										)
									);
								});
						})
						.catch(() => {
							next(new APIError('Failed to unlink'));
						});
				});
		}
	} else {
		if (prequelId === sequelId) {
			next(new APIError('Wrapper can not be prequel of itself', 422, true));
			return;
		}
		AssessmentWrapper.findOne({ _id: prequelId })
			.select('prequel sequel')
			.then((prequelWrapper) => {
				if (prequelWrapper) {
					if (prequelWrapper.prequel && prequelWrapper.prequel.equals(sequelId)) {
						next(
							new APIError(
								'Same wrapper can not be prequel as well as sequel',
								422,
								true
							)
						);
						return;
					}
					if (prequelWrapper.sequel && !prequelWrapper.sequel.equals(sequelId)) {
						// clean up previously set sequel
						AssessmentWrapper.updateOne(
							{ _id: prequelWrapper.sequel },
							{ $set: { prequel: null } }
						).exec();
					}
					AssessmentWrapper.findOne({ _id: sequelId })
						.select('prequel sequel')
						.then((sequelWrapper) => {
							if (sequelWrapper) {
								if (sequelWrapper.prequel && !sequelWrapper.prequel.equals(sequelId)) {
									if (sequelWrapper.sequel && sequelWrapper.sequel.equals(prequelId)) {
										next(
											new APIError(
												'Same wrapper can not be prequel as well as sequel',
												422,
												true
											)
										);
										return;
									}
									// clean up previously set prequel
									AssessmentWrapper.updateOne(
										{ _id: sequelWrapper.prequel },
										{ $set: { sequel: null } }
									).exec();
								}
								prequelWrapper.set('sequel', sequelWrapper._id);
								sequelWrapper.set('prequel', prequelWrapper._id);
								prequelWrapper
									.save()
									.then(() => {
										sequelWrapper
											.save()
											.then(() => {
												res.send({});
											})
											.catch(next);
									})
									.catch(next);
							} else {
								next(new APIError('Invalid sequel id', 422, true));
							}
						})
						.catch(next);
				} else {
					next(new APIError('Invalid prequel id', 422, true));
				}
			})
			.catch(next);
	}
}

function toggleHide(req, res) {
	const { wrapperId } = req.params;
	const { type } = req.query;

	AssessmentWrapper.findOne({ _id: wrapperId }).then((assessmentWrapper) => {
		if (assessmentWrapper) {
			const phases = concat(
				assessmentWrapper.permissions
					.filter((p) => p.itemType === 'Phase')
					.map((p) => p.item),
				assessmentWrapper.phases.map((p) => p.phase)
			);
			if (type === 'results') {
				const msg = assessmentWrapper.hideResults
					? 'Results are shown now.'
					: 'Results are hidden now.';
				assessmentWrapper.set('hideResults', !assessmentWrapper.hideResults);
				assessmentWrapper.markModified('hideResults');
				assessmentWrapper.save().then(() => {
					res.json({ success: true, msg });
					clearPhaseWrapperCache(phases);
				});
			} else if (type === 'detailed-analysis') {
				const msg = assessmentWrapper.hideDetailedAnalysis
					? 'Detailed analysis is shown now.'
					: 'Detailed analysis is hidden now.';
				assessmentWrapper.set(
					'hideDetailedAnalysis',
					!assessmentWrapper.hideDetailedAnalysis
				);
				assessmentWrapper.markModified('hideDetailedAnalysis');
				assessmentWrapper.save().then(() => {
					res.json({ success: true, msg });
					clearPhaseWrapperCache(phases);
				});
			} else {
				res.send({ success: false, message: 'Unknown type' });
			}
		} else {
			res.json({ success: false, msg: 'Wrapper not found.' });
		}
	});
}

async function getWrapperFormat(req, res) {
	let { assessmentId } = req.params;
	const { type } = req.query;
	if (!assessmentId) {
		res.json({ success: false, msg: 'Assessment Id is not set' });
		return;
	}
	if (type === 'wrapper') {
		const wrapper = await AssessmentWrapper.findById(ObjectId(assessmentId));
		if (!wrapper) {
			res.json({ success: false, msg: 'Wrapper not found' });
			return;
		}
		assessmentId = wrapper.core;
	}
	AssessmentCore.findById(ObjectId(assessmentId))
		.select('sections.questions')
		.populate({
			path: 'sections.questions.question',
			select: 'type options.isCorrect integerAnswer range multiOptions.isCorrect',
		})
		.then(async (assessment) => {
			if (!assessment) {
				res.json({ success: false, msg: "Can't find assessment" });
			} else {
				const data = [];
				assessment.sections.forEach((section) => {
					section.questions.forEach((question) => {
						let answer = '';
						switch (question.question.type) {
							case 'MULTIPLE_CHOICE_SINGLE_CORRECT' ||
								'LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT':
								answer = getCorrectOptions(question.question.options, false);
								break;
							case 'MULTIPLE_CHOICE_MULTIPLE_CORRECT' ||
								'LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT':
								answer = getCorrectOptions(question.question.multiOptions, true);
								break;
							case 'INTEGER':
								answer = question.question.integerAnswer;
								break;
							case 'RANGE' || 'LINKED_RANGE':
								answer = `${question.question.range.start} to ${question.question.range.end}`;
								break;
							default:
								answer = '';
								break;
						}
						data.push({
							correctMark: question.correctMark,
							incorrectMark: question.incorrectMark,
							type: question.question.type,
							correctOption: toString(answer),
							topic: question.topic,
							sub_topic: question.sub_topic,
						});
					});
				});
				res.send(data);
			}
		})
		.catch((err) => {
			res.status(500).send({ err });
		});
}

async function getRandomQuestion(req, res) {
	const { topic, sub_topic, type, level, specific, length } = req.body;
	if (!topic || !sub_topic || !length || !type) {
		res.send({
			success: false,
			message: 'Topic, subtopic, type and length are required',
		});
		return;
	}
	const questions = await questionModel
		.find({
			topic,
			sub_topic,
			type,
			level: level || [1, 2, 3],
		})
		.select('type level');
	if (questions.length < length) {
		res.send({
			success: false,
			message: `We have only ${questions.length} questions for the conditions you have selected`,
		});
		return;
	}
	const indexes = [];
	const selected = [];
	if (!specific) {
		for (var i = 0; i < length; ) {
			const random = Math.ceil(Math.random() * questions.length);
			if (!indexes.includes(random)) {
				indexes.push(random);
				i++;
			}
		}
		for (var i = 0; i < indexes.length; i++) {
			selected.push(questions[indexes[i]]);
		}
	} else {
		for (var i = 0; i < specific.length; i++) {
			if (!specific[i].type || !specific[i].questions) {
				res.send({
					success: false,
					message: 'Specification of types is not set appropriate',
				});
				return;
			}
			const indexesTemp = [];
			const currentQuestions = questions.filter(
				(que) => que.type === specific[i].type
			);
			for (
				var j = 0;
				j < specific[i].questions && currentQuestions.length !== 0;

			) {
				const random = Math.ceil(Math.random() * currentQuestions.length);
				if (!indexesTemp.includes(random)) {
					indexesTemp.push(random);
					j++;
				}
			}
			for (var j = 0; j < indexesTemp.length; j++) {
				selected.push(currentQuestions[indexesTemp[i]]);
			}
		}
	}
	res.send({
		selected,
		length: selected.length,
	});
}

const getAssementSubmissionDetails = (req, res) => {
	const { wrapperId, userId } = req.body;
	if (!wrapperId || !userId) {
		res.send({ success: false, message: 'Wrapper Id or userId are not sent' });
		return;
	}
	AssessmentWrapper.findById(wrapperId)
		.select('_id availableFrom availableTill')
		.then((assessment) => {
			Submission.findOne({
				assessmentWrapper: assessment._id,
				user: userId,
			})
				.then((submission) => {
					res.send({
						success: true,
						from: assessment.availableFrom,
						to: assessment.availableTill,
						submittedOn: submission.createdAt,
					});
				})
				.catch(() => {
					res.send({ success: false, message: 'Error in submission' });
				});
		})
		.catch(() => {
			res.send({ success: false, message: 'Error in wrapper' });
		});
};

const getAssessmentCores = async (req, res) => {
	try {
		const { role, id: userId } = req.payload;
		let { keywords, phases, skip, limit, sort } = req.body;
		const wrapperQuery = {};
		const coreQuery = {};
		if (!skip) {
			skip = 0;
		}
		if (!limit) {
			limit = 50;
		}
		if (!sort) {
			sort = -1;
		}
		if (role === 'user' || role === 'parent') {
			res.send({ success: false, msg: "You don't have permission" });
			return;
		}
		if (keywords || trim(keywords) !== '') {
			wrapperQuery.name = { $regex: keywords, $options: 'i' };
			coreQuery.identifier = { $regex: keywords, $options: 'i' };
		}
		if (
			(!phases || phases.length === 0) &&
			role !== UserRole.SUPER &&
			role !== UserRole.ADMIN
		) {
			phases = [];
			logger.info('No phases section');
			const dbUser = await UserModel.findById(userId).select('subscriptions');
			dbUser.subscriptions.forEach((subs) => {
				subs.subgroups.forEach((sub) => {
					sub.phases.forEach((phase) => {
						phases.push(phase.phase);
					});
				});
			});
			if (role === 'moderator') {
				const client = await Client.findOne({
					moderators: userId,
				});
				phases = client.phases.filter((phase) => phase);
			}
			wrapperQuery['phases.phase'] = { $in: phases };
		} else {
			wrapperQuery['phases.phase'] = { $in: phases };
		}
		const wrappers = await AssessmentWrapper.find(wrapperQuery)
			.select('_id')
			.populate({
				path: 'core',
				match: coreQuery,
			});
		const ids = [];
		wrappers.forEach((wrapper) => {
			ids.push(wrapper.id);
		});
		logger.info('Wrappers loaded');

		if (ids.length === 0) {
			res.send({ success: false, msg: 'Unexpected error' });
			return;
		}

		const count = await AssessmentCore.find({
			'wrappers.wrapper': { $in: ids },
		}).countDocuments();

		AssessmentCore.find({
			'wrappers.wrapper': { $in: ids },
		})
			.populate([
				{
					path: 'wrappers.wrapper',
					populate: 'phases.phase',
				},
				{
					path: 'analysis',
				},
			])
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 })
			.then((cores) => res.send({ cores, count, success: true }));
	} catch (err) {
		res.send({ success: false, msg: 'Error while loading' });
	}
};

const getUsersWhoStartedAssessment = (req, res) => {
	const { wrapper } = req.params;
	const { date } = req.query;

	const query = { assessmentWrapperId: wrapper };

	if (date) {
		if (trim(date)) {
			query.$and = [
				{ createdAt: { $gte: dateToStartTime(date) } },
				{ createdAt: { $lte: dateToEndTime(date) } },
			];
		}
	}

	UserLiveAssessment.find(query)
		.populate([
			{
				path: 'user',
				select: 'name email username subscriptions.subgroups.phases.phase',
				populate: {
					path: 'subscriptions.subgroups.phases.phase',
					select: 'name',
				},
			},
		])
		.then((users) => {
			res.send({ success: true, users });
		})
		.catch((err) => {
			res.send({ success: false, msg: 'Error while fetching the data', err });
		});
};

const getWrappersScheduledToday = async (req, res) => {
	const { id, role } = req.payload;
	if (role !== 'moderator' && role !== 'admin' && role !== 'super') {
		res.send({ success: false, msg: 'You are not allowed to access' });
		return;
	}

	const query = {
		$and: [
			{ availableFrom: { $gte: dateToStartTime(dayjs()) } },
			{ availableFrom: { $lte: dateToEndTime(dayjs()) } },
		],
	};

	if (role === 'moderator') {
		const client = await Client.findOne({ moderators: id });
		if (client) {
			const phases = [];
			forEach(client.phases, (phase) => {
				phases.push(toString(phase));
			});
			if (phases.length > 0) {
				query['phases.phase'] = { $in: phases };
			} else {
				res.send({ success: false, msg: 'You have no access to any phase' });
				return;
			}
		} else {
			res.send({ success: false, msg: 'You have no access to any client' });
			return;
		}
	}

	AssessmentWrapper.find(query)
		.then((wrappers) => {
			res.send({ success: true, wrappers });
		})
		.catch((err) => {
			res.send({ success: false, msg: 'Error while getting wrappers', err });
		});
};

const updateWrapperName = (req, res) => {
	const { wrapper } = req.params;
	const { name } = req.body;

	if (!name) res.send({ success: false, msg: 'Please send updated name' });

	AssessmentWrapper.updateOne({ _id: wrapper }, { $set: { name } })
		.then((updated) => {
			if (updated) {
				res.send({ success: true, msg: 'Wrapper updated' });
			} else {
				res.send({ success: false, msg: 'Wrapper not updated' });
			}
		})
		.catch(() => {
			res.send({ success: false, msg: 'Unable to update/find wrapper' });
		});
};

module.exports = {
	getassessmentwrapper,
	view,
	update,
	updatePreAnalysis,
	updateDates,
	getGrades,
	getAnalysis,
	gradeSubmissions,
	questionRatingData,
	automatedAssessment,
	getwrappers,
	getwrapper,
	getwrappertoppers,
	getsubmissions,
	categorizeCore,
	gradeCore,
	fixsyllabus,
	gradewrapper,
	archivewrapper,
	archivecore,
	getmarks,
	migrateleaderboard2,
	toggleHide,
	updateBonus,
	updateSectionInstructions,
	updateCustomSyllabus,
	updateSectionNames,
	updateGradeTime,
	resetWrapperAnalysis,
	updateClient,
	upadteDuration,
	updateIdentifier,
	updatePrequelAndSequel,
	updateServices,
	markSubmissionAsNotGraded,
	getWrapperFormat,
	getAssementSubmissionDetails,
	getRandomQuestion,
	getAssessmentCores,
	getUsersWhoStartedAssessment,
	getWrappersScheduledToday,
	updateWrapperName,
};
