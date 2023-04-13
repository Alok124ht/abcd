const Promise = require('bluebird');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');

const ObjectId = mongoose.Schema.Types.ObjectId;

const TractionSchema = new mongoose.Schema({
	//save ip address/ mac address to protect against hacks?
	phase: {
		type: ObjectId,
		ref: 'Phase',
	},
	week: {
		type: Number,
	},
	signups: [
		{
			type: ObjectId,
			ref: 'User',
		},
	],
	l1Users: [
		{
			// aka testers
			type: ObjectId,
			ref: 'User',
		},
	],
	l2Users: [
		{
			// aka genuine attempts
			type: ObjectId,
			ref: 'User',
		},
	],
	l3Users: [
		{
			// aka repeated genuine attempts
			type: ObjectId,
			ref: 'User',
		},
	],
});

// phase:
// week number:
// total []//users:
// A: []//users
// B: []//users
// C: []//users

TractionSchema.statics = {};

module.exports = mongoose.model('Traction', TractionSchema);
