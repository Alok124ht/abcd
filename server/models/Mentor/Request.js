const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const MentorRequestSchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		type: {
			type: ObjectId,
			ref: 'MentorshipType',
			required: true,
		},
		state: {
			type: String,
			required: true,
		},
		lifeCycle: [{ state: String, createdAt: Date }],
		mentor: {
			type: ObjectId,
			ref: 'User',
		},
		order: {
			type: ObjectId,
			ref: 'Order',
		},
		questionAnswers: [
			{
				key: String,
				value: {
					question: Schema.Types.Mixed,
					answer: {
						type: {
							type: String,
							enum: ['text', 'attachment'],
							required: true,
						},
						text: String,
						attachment: {
							type: ObjectId,
							ref: 'MentorshipAttachment',
						},
					},
				},
			},
		],
		conversationGroup: {
			type: ObjectId,
			ref: 'MentorshipGroup',
		},
	},
	{ timestamps: true }
);

MentorRequestSchema.virtual('isCancelable').get(function isCancelable() {
	return this.state === 'created' || this.state === 'pending';
});

module.exports = mongoose.model('MentorshipRequest', MentorRequestSchema);
