const Promise = require('bluebird');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');

const LogSchema = new mongoose.Schema({
	//save ip address/ mac address to protect against hacks?
	user: {
		type: String,
	},
	role: {
		type: String,
		default: 'user',
	},
	api: {
		type: String,
		required: true,
	},
	params: {
		type: Object,
		default: {},
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

LogSchema.statics = {};

module.exports = mongoose.model('Log', LogSchema);
