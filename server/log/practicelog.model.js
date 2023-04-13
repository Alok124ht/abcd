const mongoose = require('mongoose');

const PracticelogSchema = new mongoose.Schema({
	user: {
		type: String,
		required: true,
	},
	question: {
		type: String,
		required: true,
	},
	marked: {
		type: String,
		required: true,
	},
	correct: {
		type: String,
		required: true,
	},
	streak: {
		// streak before attempting question
		type: Number,
		required: true,
	},
	xp: {
		type: Number,
		required: true,
	},
	time: {
		type: Number,
		required: true,
	},
	attemptedAt: {
		type: Date,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

module.exports = mongoose.model('Practicelog', PracticelogSchema);
