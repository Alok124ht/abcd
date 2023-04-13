const Promise = require('bluebird');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');

const ObjectId = mongoose.Types.ObjectId;

const UpdateLogSchema = new mongoose.Schema(
	{
		leaderboard: {
			type: ObjectId,
			ref: 'Leaderboard',
		},
		ratings: [
			//done
			{
				user: {
					type: ObjectId,
					ref: 'User',
				},
				initialRating: Number,
				finalRating: Number,
				delRating: Number,
			},
		],
		usedUpdatesRemaining: [
			{
				wrapper: { type: ObjectId, ref: 'AssessmentWrapper' },
				submission: { type: ObjectId, ref: 'Submission' },
			},
		],
	},
	{ timestamps: { createdAt: 'time' } }
);

UpdateLogSchema.statics = {
	log(leaderboard, ratings, usedUpdatesRemaining) {
		this.create({ leaderboard, ratings, usedUpdatesRemaining });
	},
};

module.exports = mongoose.model('UpdateLog', UpdateLogSchema);
