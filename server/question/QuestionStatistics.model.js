const mongoose = require('mongoose');
const Question = require('./question.model').default;
const constants = require('../constants.js');
const { getPerfectTimeLimits, getLevel } = require('./utils');

const { ObjectId } = mongoose.Schema.Types;

const QuestionStatisticsSchema = new mongoose.Schema(
	{
		question: {
			type: ObjectId,
			ref: 'Question',
			index: true,
		},
		questionProperties: {
			level: Number,
		},
		attempts: [
			{
				type: ObjectId,
				ref: 'Attempt',
			},
		],
		perfectTimeLimits: {
			min: Number,
			max: Number,
		},
		medianTime: {
			type: Number,
			default: 0,
		},
		averageAccuracy: {
			type: Number,
		},
		basedOnAttemptsCount: {
			type: Number,
			default: 0,
		},
		calculatedAt: {
			type: Date,
			index: true,
			// default: Date.now,
		},
		processedAt: {
			type: Date,
			default: Date.now,
			index: true,
		},
		rating: {
			type: [
				{
					batch: { type: Number },
					initial: { type: Number },
					current: { type: Number },
				},
			],
			default: [
				{
					batch: constants.batch,
					initial: constants.initialQuestionRatingMedium,
					current: constants.initialQuestionRatingMedium,
				},
			],
		},
		fixed: {
			type: Boolean,
			default: false,
		},
		demoRank: {
			type: Number,
			default: 0,
		},
	},

	{ timestamps: true }
);

QuestionStatisticsSchema.index({ updatedAt: 1 });

QuestionStatisticsSchema.method(
	'updateStatistics',
	function updateStatistics() {
		return new Promise((resolve, reject) => {
			this.populate(
				{ path: 'attempts', select: 'time isAnswered isCorrect' },
				(error, doc) => {
					if (error) {
						reject();
						return;
					}
					if (doc.attempts.length > 100) {
						// recheck level
						const newLevel = getLevel(doc.attempts, this.perfectTimeLimits.min);
						this.questionProperties.level = newLevel;
					}

					const { min, max, medianTime } = getPerfectTimeLimits({
						attempts: doc.attempts,
						level: this.questionProperties.level,
					});

					// console.log('check things', min, max, medianTime, doc.attempts.length);

					this.perfectTimeLimits = { min, max };
					this.medianTime = medianTime;
					this.calculatedAt = Date.now();
					this.basedOnAttemptsCount = doc.attempts.length;
					if (Array.isArray(doc.attempts) && doc.attempts.length) {
						this.averageAccuracy =
							doc.attempts.filter((attempt) => attempt.isCorrect).length /
							doc.attempts.length;
					} else {
						this.averageAccuracy = 0.5;
					}
					this.save((saveError) => {
						// console.log('check version');
						if (!saveError) {
							Question.update(
								{ _id: this.question },
								{ attemptsCount: doc.attempts.length, version: 2 },
								(e) => {
									if (e) {
										console.error(e);
										reject();
									} else {
										resolve();
									}
								}
							);
						} else {
							reject();
						}
					});
				}
			);
		});
	}
);

/**
 * This function will check for any attempt not present in this.attempts for particular question
 */
QuestionStatisticsSchema.method(
	'addMissingAttempts',
	function addMissingAttempts() {
		const Attempt = mongoose.model('Attempt');
		return Attempt.find({
			_id: { $nin: this.attempts },
			question: this.question,
		})
			.select('_id')
			.then((attempts) => {
				if (attempts.length) {
					this.attempts.addToSet(...attempts.map((q) => q._id));
					return this.updateStatistics();
				}
				return null;
			});
	}
);

QuestionStatisticsSchema.statics = {
	/**
	 * Find stats if exists or create a new one
	 * it will always return QuestionStatistics,
	 * if there is no database connection error or question doesn't exist
	 */
	findByQuestionId(questionId, questionParam) {
		return new Promise((resolve, reject) => {
			const create = (question) => {
				const newQuestionStatistics = new this();
				newQuestionStatistics.question = questionId;
				newQuestionStatistics.attempts = [];
				newQuestionStatistics.questionProperties = {
					level: question.level,
				};
				newQuestionStatistics.save((saveError, savedQuestionStatistics) => {
					// console.log('check version');
					if (saveError) {
						reject(saveError);
					} else {
						question.set('statistics', newQuestionStatistics._id);
						question.set('version', 2);
						question.save((questionSaveError) => {
							// if questionSaveError
							if (questionSaveError) {
								console.error(questionSaveError);
							}
							resolve(savedQuestionStatistics);
						});
					}
				});
			};
			this.findOne({ question: questionId }).exec(
				(searchError, questionStatistics) => {
					if (searchError) {
						reject(searchError);
					} else if (!questionStatistics) {
						if (questionParam) {
							create(questionParam);
						}
						Question.findById(questionId).exec(
							(questionSearchError, searchedQuestion) => {
								if (questionSearchError) {
									reject(questionSearchError);
								} else if (!searchedQuestion) {
									reject(new Error('Question not found'));
								} else {
									create(searchedQuestion);
								}
							}
						);
					} else {
						resolve(questionStatistics);
					}
				}
			);
		});
	},
};

module.exports = mongoose.model('QuestionStatistics', QuestionStatisticsSchema);
