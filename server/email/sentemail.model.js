const mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId;

const SentEmailSchema = new mongoose.Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
		},
		type: {
			type: String,
			enum: ['Inactivity'],
		},
	},
	{ timestamps: { createdAt: 'createdAt' } }
);

SentEmailSchema.statics = {};

module.exports = mongoose.model('SentEmail', SentEmailSchema);
