const Promise = require('bluebird');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');

const ObjectId = mongoose.Schema.Types.ObjectId;

const UserstatSchema = new mongoose.Schema({
	//not using for now
	user: {
		type: ObjectId,
		ref: 'User',
	},
	// subTopics: [
	// 	{
	// 		id: String,
	// 		total: Number,
	// 		correct: Number,
	// 		// minRequired: ,
	// 		// bias:
	// concepts: {
	// 	type: Object,
	// 	default: {}, //key = conceptId, val = {total, correct, other properties like bias}
	// },
	concepts: [
		{
			id: {
				type: ObjectId,
				ref: 'Concept',
			},
			total: Number,
			correct: Number,
		},
	],
	// 	},
	// ],
	// stats: {
	// 	topics: [
	// 		{
	// 			id: String,
	// 			percent_complete: Number,
	// 			last_activity: {
	// 				type: Object,
	// 				sub_topic: String,
	// 				default: { sub_topic: '' },
	// 			},
	// 			test_performance: {
	// 				type: Object,
	// 				default: {},
	// 			},
	// 			sub_topics: [
	// 				{
	// 					id: String,
	// 					last_activity: {
	// 						type: Object,
	// 						qid: String,
	// 						startTime: String, // make it Date
	// 						// session: String
	// 						default: { qid: '', startTime: '' },
	// 					},
	// 					test_performance: {
	// 						type: Object,
	// 						default: {},
	// 					},
	// 					questions: {
	// 						type: Array,
	// 						default: [],
	// 					},
	// 				},
	// 			],
	// 		},
	// 	],
	// 	daily_activity: {
	// 		type: Array,
	// 		default: [],
	// 	},
	// 	last_activity: Object,
	// 	difficulty: {
	// 		Easy: {
	// 			type: Number,
	// 			default: 0,
	// 		},
	// 		Medium: {
	// 			type: Number,
	// 			default: 0,
	// 		},
	// 		Hard: {
	// 			type: Number,
	// 			default: 0,
	// 		},
	// 	},
	// 	calibrationDate: Date,
	// },
});

UserstatSchema.statics = {};

module.exports = mongoose.model('Userstat', UserstatSchema);
