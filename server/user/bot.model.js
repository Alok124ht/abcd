const Promise = require('bluebird');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');

const ObjectId = mongoose.Schema.Types.ObjectId;

/**
 * User Schema
 */
const BotSchema = new mongoose.Schema({
	userId: {
		type: ObjectId,
		ref: 'User',
		unique: true,
		required: true,
	},
	probSelection: {
		type: Number,
		required: true,
	},
	rating: {
		type: Number,
		required: true,
	},
	email: {
		type: String,
		required: true,
	},
	password: {
		type: String,
		required: true,
	},
});

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

/**
 * Methods
 */
BotSchema.method({});

/**
 * Statics
 */
BotSchema.statics = {
	/**
	 * List users in descending order of 'createdAt' timestamp.
	 * @param {number} skip - Number of users to be skipped.
	 * @param {number} limit - Limit number of users to be returned.
	 * @returns {Promise<User[]>}
	 */
	list({ skip = 0, limit = 50 } = {}) {
		return this.find()
			.sort({ createdAt: -1 })
			.skip(+skip)
			.limit(+limit)
			.exec();
	},
};

/**
 * @typedef User
 */
module.exports = mongoose.model('Bot', BotSchema);
