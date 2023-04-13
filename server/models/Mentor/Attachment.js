const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const AttachmentSchema = new Schema(
	{
		name: {
			type: String,
		},
		path: {
			type: String,
			required: true,
		},
		mime: {
			type: String,
		},
		bucketName: {
			type: String,
			required: true,
		},
		region: {
			type: String,
			require: true,
		},
		url: {
			// full path at which object can be accessed
			type: String,
			required: true,
		},
		meta: { type: Schema.Types.Mixed },
		thumbnail: {
			type: Schema.Types.ObjectId,
			ref: 'MentorshipAttachment',
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		comments: [
			{ type: Schema.Types.ObjectId, ref: 'MentorshipAttachmentComment' },
		],
		permissions: {
			users: [
				{
					user: { type: Schema.Types.ObjectId, ref: 'User' },
					permission: {
						type: String,
						required: true,
						enum: ['view', 'comment'],
					},
				},
			],
		},
		groups: [{ type: Schema.Types.ObjectId, ref: 'MentorshipGroup' }],
	},
	{ timestamp: true }
);

AttachmentSchema.static('get', (id, projection = {}) =>
	this.findById(id, projection)
		.populate('thumbnail')
		.exec()
);

module.exports = mongoose.model('MentorshipAttachment', AttachmentSchema);
