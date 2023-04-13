const Promise = require('bluebird');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');

const ResponseSchema = new mongoose.Schema(
	{
		exam: {
			type: String,
		},
		email: {
			type: String,
		},
		phone: {
			type: String,
		},
		body: {
			type: String,
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{ usePushEach: true }
);

module.exports = mongoose.model('Response', ResponseSchema);
