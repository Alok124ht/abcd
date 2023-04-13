/* eslint-disable no-param-reassign */
const dynamoose = require('dynamoose');
const ObjectId = require('mongodb').ObjectId;

const eventSessionSchema = new dynamoose.Schema(
	{
		i: {
			type: String,
			hashKey: true,
			default: () => ObjectId().toString(),
		},
		d: {
			type: String,
			alias: 'device',
			required: true,
		},
	},
	{ timestamps: { createdAt: 'e', updatedAt: null } }
);

module.exports = dynamoose.model('EventSession', eventSessionSchema);
