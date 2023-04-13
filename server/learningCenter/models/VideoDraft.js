const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const VideoDraftSchema = new mongoose.Schema(
	{
		guid: String,
		srcVideo: {
			type: String,
			required: true,
			unique: true,
		},
		srcBucket: { type: String, required: true },
		createdBy: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		title: {
			type: String,
		},
		description: {
			type: String,
		},
		isProcessed: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model('VideoDraft', VideoDraftSchema);
