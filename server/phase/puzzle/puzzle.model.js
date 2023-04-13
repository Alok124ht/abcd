const mongoose = require('mongoose');
const PuzzleAttempt = require('../../models/PuzzleAttempt');
const Schema = mongoose.Schema;

const PuzzleSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
		},
		content: {
			rawContent: {
				type: String,
			},
		},
		answer: {
			type: Number,
		},
		level: {
			type: Number,
			default: 1,
		},
		hint: {
			rawContent: {
				type: String,
			},
		},
		solution: {
			rawContent: {
				type: String,
			},
		},
		verifiedBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},
		publishedBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},
		visibleTill: {
			type: Date,
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		concepts: [
			{
				concept: {
					type: Schema.Types.ObjectId,
					ref: 'Concept',
				},
			},
		],
		attemptsCount: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

/**
 * Methods
 */
PuzzleSchema.method({});

/**
 * Statics
 */
PuzzleSchema.statics = {
	get(id) {
		return this.findOne({ _id: id }).exec();
	},

	getMany(skip) {
		return this.find({}).skip(skip).limit(10).exec();
	},

	securePuzzle(puzzle) {
		const newPuzzle = {};
		if (puzzle) {
			newPuzzle._id = puzzle._id;
			newPuzzle.title = puzzle.title;
			newPuzzle.content = puzzle.content;
			return newPuzzle;
		}

		return null;
	},

	//1st lastAttemptTime > today, 00:00.
	//2nd visibleTill > xxx and unattempted!
	//3rd new puzzle, visible not set!
	//4th visibleTill < xxx and unattempted!

	getPuzzleOfTheDay(userId) {
		return this.find({}).then((puzzles) => {
			return PuzzleAttempt.find({ user: userId }).then((attempts) => {
				let timeToday = new Date();
				timeToday.setHours(0, 0, 0, 0);
				let recentAttempt = null;
				const attemptMap = {};
				const puzzleMap = {};
				attempts.forEach((attempt) => {
					attemptMap[attempt.puzzle] = true;
					if (
						!recentAttempt &&
						new Date(attempt._id.getTimestamp()).getTime() > timeToday.getTime()
					) {
						recentAttempt = attempt;
					}
				});
				let currentUnattempted = null;
				let oldUnattempted = null;
				let newPuzzle = null;
				puzzles.forEach((puzzle) => {
					puzzleMap[puzzle._id] = puzzle;
					if (puzzle.visibleTill && !attemptMap[puzzle._id]) {
						if (puzzle.visibleTill.getTime() > timeToday.getTime()) {
							currentUnattempted = puzzle;
						} else {
							oldUnattempted = puzzle;
						}
					} else {
						newPuzzle = puzzle;
					}
				});

				if (recentAttempt) {
					// if last attempt time was > today 00:00, use will see today's puzzle
					const actualPuzzle = puzzleMap[recentAttempt.puzzle];
					const newPuzzle = {};
					newPuzzle._id = actualPuzzle._id;
					newPuzzle.title = actualPuzzle.title;
					newPuzzle.content = actualPuzzle.content;
					newPuzzle.answer = actualPuzzle.answer;
					newPuzzle.solution = actualPuzzle.solution;
					newPuzzle.response = recentAttempt.answer;
					return Promise.resolve(newPuzzle);
				} else if (currentUnattempted) {
					return Promise.resolve(this.securePuzzle(currentUnattempted));
				} else if (newPuzzle) {
					let time = new Date();
					time.setHours(23, 59, 59, 999);
					newPuzzle.visibleTill = time;
					newPuzzle.save();
					return Promise.resolve(this.securePuzzle(newPuzzle));
				} else if (oldUnattempted) {
					return Promise.resolve(this.securePuzzle(oldUnattempted));
				} else {
					return Promise.resolve(null);
				}
			});
		});
		// return this.findOne({ visibleTill: { $gt: new Date() } }).then(
		// 	(publishedPuzzle) => {
		// 		if (publishedPuzzle) {
		// 			return PuzzleAttempt.findOne({
		// 				puzzle: publishedPuzzle._id,
		// 				user: userId,
		// 			}).then((attemptedPuzzle) => {
		// 				if (attemptedPuzzle) {
		// 					const newPuzzle = {};
		// 					newPuzzle._id = publishedPuzzle._id;
		// 					newPuzzle.title = publishedPuzzle.title;
		// 					newPuzzle.content = publishedPuzzle.content;
		// 					newPuzzle.answer = publishedPuzzle.answer;
		// 					newPuzzle.solution = publishedPuzzle.solution;
		// 					newPuzzle.response = attemptedPuzzle.answer;
		// 					return Promise.resolve(newPuzzle);
		// 				} else {
		// 					return Promise.resolve(this.securePuzzle(publishedPuzzle));
		// 				}
		// 			});
		// 		} else {
		// 			return this.findOne(
		// 				{ visibleTill: { $exists: false } },
		// 				{ content: 1 }
		// 			).then((newPublishedPuzzle) => {
		// 				if (newPublishedPuzzle) {
		// 					let time = new Date();
		// 					time.setHours(23, 59, 59, 999);
		// 					newPublishedPuzzle.visibleTill = time;
		// 					newPublishedPuzzle.save();
		// 				} else {
		// 					// get old puzzle, un attempted
		// 				}

		// 				return Promise.resolve(this.securePuzzle(newPublishedPuzzle));
		// 			});
		// 		}
		// 	}
		// );
	},

	//get puzzle attempts and puzzles both!!!

	//1st lastAttemptTime > lastDay, 23:59.
	//2nd visibleTill > xxx and unattempted!
	//3rd new puzzle, visible not set!
	//4th visibleTill < xxx and unattempted!
};

/**
 * @typedef Question
 */
module.exports = mongoose.model('Puzzle', PuzzleSchema);
