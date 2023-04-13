const mongoose = require('mongoose');

const QuestionlogSchema = new mongoose.Schema({
	adjustedMeanFactor: {
		type: Number,
		required: true,
	},
	adjustedDataLevel: {
		type: Number,
		required: true,
	},
	dataLevel: {
		type: Number,
		required: true,
	},
	attemptsCount: {
		type: Number,
		required: true,
	},
	attempt: {
		type: Number,
		required: true,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

module.exports = mongoose.model('Questionlog', QuestionlogSchema);
