const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const LinkSchema = new mongoose.Schema(
	{
		total_questions: {
			type: Number,
			required: true,
		},
		questions: [
			{
				type: ObjectId,
				ref: 'Question',
			},
		],
		topicId: {
			type: Number,
			// required: true,
		},
		subTopic: {
			type: ObjectId,
		},
		tag: {
			type: String,
		},
		level: {
			type: Number,
			default: 1,
		},
		content: {
			type: Object,
		},
		type: {
			type: String,
			required: true,
			default: 'LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT',
		},
		client: {
			type: ObjectId,
			ref: 'Client',
		},
	},
	{ timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = mongoose.model('Link', LinkSchema);
