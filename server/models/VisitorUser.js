const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const VisitorUser = new Schema(
	{
		identifier: String,
		source: {
			type: String,
			enum: [
				'facebook',
				'telegram',
				'whatsapp',
				'instagram',
				'google',
				'youtube',
				'twitter',
				'linkedin',
				'unknown',
			],
			required: true,
		},
		unknownSourceName: {
			type: String,
		},
		otherSources: [
			{ name: String, data: {}, createdAt: { type: Date, default: Date.now } },
		],
		souceData: {},
		user: {
			type: ObjectId,
			ref: 'User',
		},
		convertedBy: {
			type: String,
			emun: ['Sign Up', 'Sign In'],
		},
		signInWith: {
			type: String,
			enum: ['Google', 'Email'],
		},
		activity: [
			{
				type: {
					type: String,
				},
				data: {},
				createdAt: { type: Date, default: Date.now },
			},
		],
	},
	{ timestamps: true }
);

module.exports = mongoose.model('VisitorUser', VisitorUser);
