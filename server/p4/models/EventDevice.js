/* eslint-disable no-param-reassign */
const dynamoose = require('dynamoose');
const ObjectId = require('mongodb').ObjectId;

const trackingEventSchema = new dynamoose.Schema(
	{
		i: {
			type: String,
			hashKey: true,
			default: () => ObjectId().toString(),
		},
		u: {
			alias: 'user-agent',
			type: String,
		},
		b: {
			type: String,
			alias: 'browser',
			/**
			 * could be Chrome, Firefox, Safari or any other browser
			 */
		},
		bv: {
			type: String,
			alias: 'browserVersion',
		},
		o: {
			type: String,
			alias: 'os',
		},
		ov: {
			type: String,
			alias: 'osVersion',
		},
	},
	{ timestamps: { createdAt: 'e', updatedAt: null } }
);

module.exports = dynamoose.model('Device', trackingEventSchema);
