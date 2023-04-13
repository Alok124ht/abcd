const mongoose = require('mongoose');
const constants = require('../constants.js');
const QuestionStatistics = require('../question/QuestionStatistics.model');
const Puzzle = require('../puzzle/puzzle.model');

const ObjectId = mongoose.Schema.Types.ObjectId;
const Mixed = mongoose.Schema.Types.Mixed;

const PuzzleAttemptSchema = new mongoose.Schema({
	user: {
		type: ObjectId,
		ref: 'User',
		required: true,
	},
	puzzle: {
		type: ObjectId,
		ref: 'Question',
		required: true,
	},
	answer: {
		type: Number,
		required: true,
	},
	isCorrect: Boolean,
});

PuzzleAttemptSchema.statics = {
	addAttempt(userId, question) {
		return new Promise((resolve, reject) => {
			QuestionStatistics.findByQuestionId(question.question).then(
				(questionStatistics) => {
					const attempt = new this({
						user: userId,
						question: question.question,
						// startTime: question.startTime, // cehck this
						endTime: null,
						speed: null,
						isCorrect: null,
						isAnswered: false,
						answer: null,
						xpEarned: 0,
						perfectTimeLimits: questionStatistics.perfectTimeLimits,
					});

					return attempt.save((error) => {
						if (error) {
							reject(error);
						} else {
							resolve(attempt);
						}
						questionStatistics.attempts.push(attempt._id);
						questionStatistics.save();
					});
				}
			);
		});
	},
};

module.exports = mongoose.model('PuzzleAttempt', PuzzleAttemptSchema);
