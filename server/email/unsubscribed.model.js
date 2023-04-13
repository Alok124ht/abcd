const Promise = require('bluebird');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');

const ObjectId = mongoose.Schema.Types.ObjectId;

const UnsubscribedSchema = new mongoose.Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
		},
		unsubscriptionDate: {
			type: Date,
			default: Date.now,
		},
	},
	{ timestamps: { createdAt: 'createdAt' } }
);

UnsubscribedSchema.statics = {};

module.exports = mongoose.model('Unsubscribed', UnsubscribedSchema);
