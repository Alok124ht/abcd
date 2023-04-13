const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const AttachmentCommentSchema = new mongoose.Schema(
	{
		createdBy: {
			type: Schema.Types.ObjectId,
			required: true,
		},
		content: {
			type: Schema.Types.Mixed,
		},
		attachment: {
			type: Schema.Types.ObjectId,
			ref: 'MentorshipAttachment',
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model(
	'MentorshipAttachmentComment',
	AttachmentCommentSchema
);
