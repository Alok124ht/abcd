/* eslint-disable no-param-reassign */
const dynamoose = require('dynamoose');
const ObjectId = require('mongodb').ObjectId;

const {
	actionKeys,
	keysByAction,
	subjectModelKeys,
	actionsByKey,
	keysBySubjectModel,
	subjectModelsByKey,
} = require('./config');

const trackingEventSchema = new dynamoose.Schema(
	{
		i: {
			type: String,
			hashKey: true,
			default: () => ObjectId().toString(),
		},
		a: {
			type: String,
			alias: 'actor',
			ref: 'User',
			// could be null
			// required: true,
		},
		t: {
			//   alias: "action",
			set: (action) => keysByAction[action],
			get: (key) => actionsByKey[key],
			required: true,
			type: String,
			enum: actionKeys,
		},
		s: {
			type: String,
			alias: 'subject',
			required: true,
			refPath: 'sm',
		},
		sm: {
			required: true,
			type: String,
			enum: subjectModelKeys,
			set: (subjectModel) => keysBySubjectModel[subjectModel],
			get: (key) => subjectModelsByKey[key],
		},
		c: {
			type: String,
			alias: 'category',
		},
		l: {
			type: String,
			alias: 'label',
		},
		ss: {
			// sessionId
			type: String,
		},
	},
	{ timestamps: { createdAt: 'e', updatedAt: null } }
);

module.exports = dynamoose.model('TrackingEvent', trackingEventSchema);
