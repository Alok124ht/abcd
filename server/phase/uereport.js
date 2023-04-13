const mongoose = require('mongoose');

const { ObjectId } = mongoose.Types;

const UEReportSchema = new mongoose.Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
		},
		phase: {
			type: ObjectId,
			ref: 'Phase',
		},
		lastSynced: {
			type: Date,
			default: Date.now,
		},
		topicMocks: {
			type: Number,
			default: 0,
		},
		overallRank: {
			type: Number,
			default: 0,
		},
		otherTests: [
			{
				wrapperId: {
					type: ObjectId,
					ref: 'AssessmentWrapper',
				},
				wrapperName: {
					type: String,
					default: 0,
				},
				percent: {
					type: Number,
					default: 0,
				},
				marks: {
					// marks scored by user
					type: Number,
				},
				maxMarks: {
					// maximum marks of assessment
					type: Number,
				},
			},
		],
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

UEReportSchema.statics = {};

UEReportSchema.method('isActive', function isActive() {
	const now = Date.now();
	return now <= this.endDate && now >= this.startDate;
});

module.exports = mongoose.model('UEReport', UEReportSchema);
