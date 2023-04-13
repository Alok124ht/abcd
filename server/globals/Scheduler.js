import logger from '../../config/winston';
import { forEach, get, join } from 'lodash';

const schedule = require('node-schedule');
const { default: Bottleneck } = require('bottleneck');
const { ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');
const AssessmentCoreCache = require('../cache/AssessmentCore');
const QuestionStatisticsCache = require('../cache/QuestionStatistics');
// const AssessmentWrapper = require('../assessment/AssessmentWrapper');
const Submission = require('../assessment/submission.model').default;
const Attempt = require('../models/Attempt').default;
const QuestionStatistics = require('../question/QuestionStatistics.model');
const { sendEmail } = require('../utils/mail');
const User = require('../user/user.model').default;
const Session = require('../session/session.model').default;
const Traction = require('../query/traction');
const Email = require('../email/email.model');
const Unsubscribed = require('../email/unsubscribed.model');
const Question = require('../question/question.model').default;

const GradeTime = require('../assessment/gradeTime.model').default;
const AssessmentWrapper =
	require('../assessment/assessmentWrapper.model').default;
const WrapperData = require('./WrapperData');

const { isAnswerCorrect, isAnswered } = require('../lib.js');

const answerType = {
	MULTIPLE_CHOICE_SINGLE_CORRECT: 'option',
	MULTIPLE_CHOICE_MULTIPLE_CORRECT: 'options',
	LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT: 'option',
	LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT: 'options',
	INTEGER: 'number',
	RANGE: 'number',
	LINKED_RANGE: 'number',
};

function updateQuestionStatisticsOptimized(attempts) {
	//
	const questionMaps = {};

	attempts.forEach((attempt) => {
		if (!questionMaps[attempt.question]) {
			questionMaps[attempt.question] = [];
		}
		questionMaps[attempt.question].push(attempt._id);
	});

	const quetionIds = Object.keys(questionMaps).map((k) => ObjectId(k));

	QuestionStatisticsCache.getMany(quetionIds, (err, questionStatistics) => {
		// s s a s s //

		const bulk = QuestionStatistics.collection.initializeOrderedBulkOp();
		let totalUpdates = 0;
		questionStatistics.forEach((qs, idx) => {
			if (qs) {
				totalUpdates += 1;
				// updateee.push({_id: qs._id, attempts: questionMaps[quetionIds[idx]]})
				bulk.find({ _id: qs._id }).update({
					$push: { attempts: { $each: questionMaps[quetionIds[idx].toString()] } },
					$set: { updatedAt: new Date() },
				});
			} else {
				const questionStatistics_ = new QuestionStatistics({
					question: quetionIds[idx],
					questionProperties: {
						level: 2, // question.level,
					},
					attempts: questionMaps[quetionIds[idx]].toString(),
				});
				questionStatistics_.save().then((savedQuestionStatistics) => {
					Question.update(
						{ _id: quetionIds[idx] },
						{ $set: { statistics: savedQuestionStatistics._id } }
					).exec();
				});
			}
		});

		if (totalUpdates) {
			bulk.execute(() => {
				// const t = new Date().getTime();
				// console.log('check time xxx', t)
				// result contains stats of the operations
			});
		}
	});
}

function addAttemptAndUpdateStatisticsOptimized(assessmentCore, submissions) {
	const newAttempts = [];

	submissions.forEach((submission) => {
		submission.response.sections.forEach((sectionResponse, sIdx) => {
			sectionResponse.questions.forEach((questionResponse, qIdx) => {
				const { question } = assessmentCore.sections[sIdx].questions[qIdx];
				newAttempts.push({
					user: submission.user,
					question: question._id,
					mode: 'assessment',
					reference: submission.assessmentWrapper,
					onModel: 'AssessmentWrapper',
					answer: {
						type: answerType[question.type],
						data: isAnswered(questionResponse.answer) ? questionResponse.answer : '',
					},
					isAnswered: isAnswered(questionResponse.answer),
					isCorrect: isAnswerCorrect(questionResponse.answer, question),
					isSkipped: !isAnswered(questionResponse.answer),
					time: questionResponse.time / 1000,
				});
			});
		});
		Submission.update(
			{ _id: submission._id },
			{ $set: { attemptsUpdated: true } }
		).exec();
	});

	Attempt.insertMany(newAttempts, (err, savedAttempts) => {
		if (!err) {
			updateQuestionStatisticsOptimized(savedAttempts);
		}
	});
}

function processAttempts() {
	// add something to find and fix submissions
	console.log('scheduler > processAttempts: called');
	Submission.findOneAndUpdate(
		{ attemptsUpdated: false },
		{ $set: { attemptsUpdated: true } },
		{ assessmentCore: 1 }
	).then((submission) => {
		if (submission) {
			console.log('scheduler > processAttempts: processing');
			AssessmentCoreCache.getWithSolution(
				submission.assessmentCore,
				(err, assessmentCore) => {
					if (!err) {
						addAttemptAndUpdateStatisticsOptimized(assessmentCore, [submission]);
						// try to find more submissions with same assessment core!!
						// this can save time as bulk update is used.
						// but need to be test is performance increase is considerable
						// const t = new Date().getTime();
						// console.log('check time aaa', t)
						// addAttemptAndUpdateStatistics(assessmentCore, submission);
					}
				}
			);
		}
	});
}

function sendEmails() {
	if (process.env.INSTANCE_ID !== '0') {
		// only one instance from one server should send email
		return;
	}
	// random time is used to prevent all servers sending same email
	const randomTime = Math.floor(Math.random() * 10000);
	const timeout = 30000 + randomTime;
	console.log('scheduler > sendEmail: called');
	setTimeout(() => {
		if (process.env.NODE_ENV === 'production') {
			Email.find({ sent: true })
				.sort({ _id: -1 })
				.limit(1)
				.exec()
				.then((emails) => {
					let shouldSendEmails = false;
					if (!emails.length) {
						// no email has been sent yet!
						shouldSendEmails = true;
					} else {
						const lastSent = emails[0].createdAt;
						const interval = 12 * 60 * 60 * 1000;
						// every 12 hours
						if (new Date().getTime() > lastSent.getTime() + interval) {
							shouldSendEmails = true;
						}
					}

					if (shouldSendEmails) {
						Email.find({ sent: false })
							.exec()
							.then((mails) => {
								if (mails.length) {
									console.log('scheduler > sendEmail: sending emails');
									let text = '';
									mails.forEach((mail) => {
										text += `${mail.subject} ${mail.data}\n`;
										mail.set('sent', true);
										mail.save();
									});
									text += '\n';
									const supportEmails = ['neel@prepseed.com', 'vivek@prepseed.com'];
									sendEmail({
										subject: 'Routine checkup',
										to: supportEmails,
										body: text,
										bodyType: 'text',
									});
								}
							});
					}
				});
		}
	}, timeout);
}

function processQuestionStats() {
	const now = new Date();
	const fiveMinutesAgo = new Date(now.getTime() - 300000);
	const oneMinuteAgo = new Date(now.getTime() - 60000);
	console.log('scheduler > processQuestionStats: called');
	const processOne = () =>
		QuestionStatistics.findOneAndUpdate(
			{
				$or: [
					{
						processedAt: { $exists: false },
						calculatedAt: { $exists: false },
						updatedAt: { $gte: fiveMinutesAgo },
					},
					{
						processedAt: { $lte: oneMinuteAgo },
						calculatedAt: { $exists: false },
						updatedAt: { $gte: fiveMinutesAgo },
					},
					{
						processedAt: { $exists: false },
						calculatedAt: { $lte: fiveMinutesAgo },
						updatedAt: { $gte: fiveMinutesAgo },
					},
					{
						processedAt: { $lte: oneMinuteAgo },
						calculatedAt: { $lte: fiveMinutesAgo },
						updatedAt: { $gte: fiveMinutesAgo },
					},
				],
			},
			{ $set: { processedAt: new Date() } }
		).then((qs) => {
			if (qs) {
				console.log('scheduler > processQuestionStats: processing');
				qs.updateStatistics();
			}
			return null;
		});

	const limiter = new Bottleneck({ maxConcurrent: 1 });
	for (let i = 0; i < 5; i += 1) {
		limiter.schedule(processOne);
	}
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

const refDate = new Date('2019-07-29T00:00:00Z'); // first week of august

function remindUsers() {
	const d1 = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
	const d2 = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
	console.log('scheduler > remindUsers: called');
	User.findOneAndUpdate(
		{
			$or: [
				{ labelUpdate: { $exists: false }, createdAt: { $gte: d2, $lte: d1 } },
				{ labelUpdate: { $lte: d1 }, createdAt: { $gte: d2, $lte: d1 } },
			],
		},
		{ $set: { labelUpdate: new Date() } }
	).then((user) => {
		if (user) {
			console.log('scheduler > remindUsers: user found');
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

						console.log('all done....');

						if (phase) {
							Traction.findOne({ phase, week }).then((traction) => {
								if (traction) {
									// console.log('traction found, updating ...', traction, query);
									Traction.update({ _id: traction._id }, query).then(() => {
										User.update(
											{ _id: user._id },
											{ $set: { label, labelUpdate: new Date() } }
										).then(() => {
											sendRemaineder(user, label, phase);
										});
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
												).then(() => {
													sendRemaineder(user, label, phase);
												});
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
					});
			});

			// console.log('check user!!!', user._id);
		} else {
			// console.log('no user found');
		}
		//
	});
}

function sendRemaineder(user, label, phase) {
	if (
		phase.toString() === '5e14f21bd7b3d8274ce4be9f' &&
		label === 'SIGNUP' &&
		process.env.NODE_ENV === 'production'
	) {
		Unsubscribed.findOne({ user: user._id }).then((u) => {
			if (!u) {
				let text = `Hi ${user.name ? user.name : ''},\n\n`;
				text +=
					'It appears that you have not started your aptitude preparation.\n\n';
				text += 'All it takes to improve aptitude is practice.';
				text +=
					' One month is a good amount of time to learn and understand the pattern of questions and test taking strategies.\n\n';
				text +=
					'Prepseed has designed a 20 day course for you to improve your aptitude efficiently. You just need to attempt assessments (of duration 25-30 mins each) as per schedule. Visit https://jobs.prepseed.com to start preparing.\n\n';
				text +=
					'"A journey of a thousand miles begins with a single step" - Lao Tzu \n\n';
				text += 'Thank You,\nTeam Prepseed\n\n';
				text += `As always, if you'd rather not get emails like this, you can unsubscribe by clicking this link - https://jobs.prepseed.com/unsubscribe/${user._id}${user.netXp.xp}`;
				const smtpTransport = nodemailer.createTransport({
					service: 'gmail',
					auth: {
						user: 'help@prepseed.com',
						pass: '?fH_XyNx#W$3t!E=',
					},
				});

				const mailOptions = {
					to: user.email,
					from: 'help@prepseed.com',
					subject: 'Checkout 20 Day Course Schedule',
					text,
				};
				smtpTransport.sendMail(mailOptions, () => {});
			}
		});
	}
}

function gradeSubmissionsGeneric(
	assessmentWrapper, // assessmentWrapper also contains analysis
	wrapperAnalysis
) {
	const exclude = wrapperAnalysis.submissions.map((s) => s.submission);
	return Submission.find({
		assessmentWrapper: assessmentWrapper._id,
		_id: { $nin: exclude },
	})
		.populate([{ path: 'user', select: 'subscriptions' }])
		.then(() => Promise.resolve(assessmentWrapper));
}

export function gradeAssessment() {
	// run on only one core
	console.log('scheduler > gradeAssessment: called');

	GradeTime.findOneAndUpdate(
		{ graded: false, time: { $lte: new Date() } },
		{ $set: { graded: true } }
	)
		.sort({ createdAt: -1 })
		.then((gt) => {
			if (gt) {
				console.log('scheduler > remindUsers: gradetime found');
				logger.info({ gt });
				AssessmentWrapper.findById(gt.wrapper)
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
						{
							path: 'phases.phase',
							select: 'name',
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
								} else {
									gradeSubmissionsGeneric(
										assessmentWrapper,
										assessmentWrapper.analysis
									).then(() => {
										AssessmentWrapper.update(
											{ _id: assessmentWrapper._id },
											{ $set: { graded: true } }
										).then(() => {
											let phasesList = [];
											forEach(assessmentWrapper.phases, (ph) => {
												if (get(ph, 'phase.name', null)) {
													phasesList.push(get(ph, 'phase.name'));
												}
											});
											const text = `Graded assessment ${
												assessmentWrapper.name
											} for phases ${join(phasesList, ', ')}.`;

											logger.info(text);
										});
									}); // try to grade only new submissions to optimize things!
								}
							});
						}
					});
			}
		});
}

schedule.scheduleJob('*/1 * * * *', sendEmails); // move this to diff lib
schedule.scheduleJob('*/10 * * * * *', processAttempts); // move this in lambda
schedule.scheduleJob('*/1 * * * *', processQuestionStats); // move this in lambda

schedule.scheduleJob('* * * * *', remindUsers); // move this to diff lib

schedule.scheduleJob('*/2 * * * *', gradeAssessment); // move this to diff lib
