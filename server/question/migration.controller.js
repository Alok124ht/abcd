const Question = require('./question.model').default;
const QuestionStatistics = require('./QuestionStatistics.model');
const Attempt = require('../models/Attempt').default;
const { getPerfectTimeLimits } = require('./utils');

const isAnswerCorrect = (oldAttempt, question) =>
	question.options.every((option) => {
		if (option.isCorrect) {
			return option._id.equals(oldAttempt.option);
		}
		return !option._id.equals(oldAttempt.option);
	});

const convertDataFromoldAttemptToAttempt = (oldAttempt, question) => {
	const startTime = Date.now() - 2 * 24 * 60 * 60 * 1000;
	const { time } = oldAttempt;
	const perfectTimeLimits = getPerfectTimeLimits({
		attempts: [],
		level: question.level,
	});
	let speed = 5;
	if (time < perfectTimeLimits.min) {
		speed = 10;
	}
	if (time > perfectTimeLimits.max) {
		speed = 0;
	}
	return {
		user: oldAttempt.user,
		question: question._id,
		mode: oldAttempt.mode,
		batch: oldAttempt.batch,
		answer: {
			type: 'option',
			data: oldAttempt.option,
		},
		isAnswered: true,
		isCorrect: isAnswerCorrect(oldAttempt, question),
		startTime,
		endTime: startTime + time,
		time,
		perfectTimeLimits,
		speed,
	};
};

const migrateQuestion = (question) =>
	new Promise((resolve, reject) => {
		if (typeof question.version === 'number' && question.version === 1) {
			reject({ message: 'already migrated' });
		} else {
			const oldAttempts = question.stats.attempts;
			if (oldAttempts) {
				Attempt.insertMany(
					oldAttempts.map((oa) => convertDataFromoldAttemptToAttempt(oa, question)),
					(error, attemptDocs) => {
						QuestionStatistics.findByQuestionId(question._id)
							.then((questionStatistics) => {
								attemptDocs.forEach((attemptDoc) =>
									questionStatistics.attempts.push(attemptDoc._id)
								);
								questionStatistics.save();
								resolve({ message: `Migrated ${question._id}` });
							})
							.catch((searchQuestionStatisticsError) => {
								reject(searchQuestionStatisticsError);
							});
					}
				);
			}
		}
	});

const handleMigrateQuestionRequest = (req, res) => {
	const { questionId } = req.body;
	Question.findById(questionId).exec((error, question) => {
		migrateQuestion(question)
			.then((r) => {
				res.send(r);
			})
			.catch((migrationError) => {
				res.status(500).send({ message: migrationError.message, question });
			});
	});
};

const handleMigrateQuestionsRequest = (req, res) => {
	const { filter: rawFilter, limit } = req.body;
	const filter = { version: { $ne: 1 } };
	const query = Question.find(filter);
	if (limit) {
		query.limit(parseInt(limit, 10));
	}

	query.select('options level stats.attempts').exec((error, questions) => {
		let completedCount = 0;
		const errors = [];
		const respondIfComplete = ({ success, questionId, error: e }) => {
			completedCount += 1;

			if (!success) {
				errors.push({ questionId, e });
			}
			if (completedCount === questions.length) {
				res.send({ total: questions.length, completedCount, errors });
			}
		};
		if (questions.length > 0) {
			questions.forEach((question) => {
				migrateQuestion(question)
					.then((r) => {
						respondIfComplete({ success: true });
						// res.send(r);
					})
					.catch((migrationError) => {
						respondIfComplete({
							success: false,
							questionId: question._id,
							error: migrationError.message,
						});
						// console.error(migrationError);
						// res.status(500).send({ message: migrationError.message, question });
					});
			});
		} else {
			res.send({ message: 'No more questions to migrate' });
		}
	});
};

module.exports = {
	handleMigrateQuestionRequest,
	handleMigrateQuestionsRequest,
};
