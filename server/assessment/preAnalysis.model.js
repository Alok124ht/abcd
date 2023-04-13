const Promise = require('bluebird');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');

const ObjectId = mongoose.Schema.Types.ObjectId;

const constants = require('../constants.js');

const PreAnalysisSchema = new mongoose.Schema(
	{
		assessment: {
			type: ObjectId,
			ref: 'Assessment',
		},
		assessmentCore: {
			type: ObjectId,
			ref: 'AssessmentCore',
		},
		stats: {
			marks: Array,
			hist: Array,
			sections: [
				{
					id: String,
					questions: [
						{
							id: String,
							sumSqTime: Number,
							sumTime: Number,
							correctAttempts: Number,
							totalAttempts: Number,
							times: {
								type: Array,
								default: [],
							},
						},
					],
					incorrect: { type: Number, default: 0 },
					correct: { type: Number, default: 0 },
					sumTime: { type: Number, default: 0 },
					times: {
						type: Array,
						default: [],
					},
				},
			],
			sumAccuracy: {
				type: Number,
				default: 0,
			},
			sumSqAccuracy: {
				type: Number,
				default: 0,
			},
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

PreAnalysisSchema.statics = {
	// get(id) {
	// 	return this.findById(id)
	// 		.populate('sections.questions.question')
	// 		.exec()
	// 		.then((assessment) => {
	// 			if (assessment) {
	// 				return assessment;
	// 			}
	// 			const err = new APIError(
	// 				'No such assessment exists!',
	// 				httpStatus.NOT_FOUND
	// 			);
	// 			return Promise.reject(err);
	// 		});
	// },
};

module.exports = mongoose.model('PreAnalysis', PreAnalysisSchema);
