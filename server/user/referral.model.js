const Promise = require('bluebird');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');

const ObjectId = mongoose.Types.ObjectId;

/**
 * User Schema
 */
const ReferralSchema = new mongoose.Schema(
	{
		referrerUsername: {
			// this is username of referrer // old
			type: String,
			required: true,
		},
		referred: {
			// this is userid of referred // old
			type: String,
			required: true,
			unique: true,
		},
		complete: {
			// old
			type: Boolean,
			default: false,
		},
		referrer: {
			type: ObjectId,
			ref: 'User',
		},
		referredUser: {
			type: ObjectId,
			ref: 'User',
		},
		medium: {
			type: String,
			enum: ['LINK', 'EMAIL'],
		},
		status: {
			type: String,
			enum: ['SENT', 'COMPLETE'], //we are not tracking sent for now!!
		},
	},
	{
		timestamps: { createdAt: 'createdAt' },
	}
);

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

/**
 * Methods
 */
ReferralSchema.method({});

/**
 * Statics
 */
ReferralSchema.statics = {
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
module.exports = mongoose.model('Referral', ReferralSchema);

/*

localhost:3000/?code=bWFya3VzajEz

*/
