const mongoose = require('mongoose');
const Discount = require('./Discount');

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

const CouponSchema = new mongoose.Schema(
	{
		startTime: {
			type: Date,
			required: true,
		},
		endTime: {
			type: Date,
			required: true,
		},
		items: [
			{
				itemModel: {
					type: String,
					enum: ['MentorshipType', 'ServicePlan'],
				},
				value: {
					type: mongoose.Schema.ObjectId,
					refPath: 'items.itemModel',
				},
			},
		],
		item: {
			type: mongoose.Schema.ObjectId,
			refPath: 'itemModel',
		},
		itemModel: {
			type: String,
			// required: true,
			enum: ['MentorshipType', 'ServicePlan'],
		},
		code: {
			type: String,
			required: true,
		},
		validations: [
			{
				type: {
					type: String,
				},
				value: mongoose.Schema.Types.Mixed,
			},
		],
		maxTimes: {
			type: Number,
			default: 0,
		},
		timesUsed: {
			type: Number,
			default: 0,
			required: true,
			min: [0, 'Can not be used less than once'],
		},
		isAvailable: {
			type: Boolean,
			default: true,
		},
		discount: Discount,
		createdBy: {
			type: ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

CouponSchema.static('findActiveCouponByCode', function findActiveCouponByCode(
	code,
	callback
) {
	const query = {};
	const now = Date.now();
	query.isAvailable = true;
	query.code = { $regex: new RegExp(`^${code}$`, 'i') };
	query.endTime = { $gte: now };
	query.startTime = { $lte: now };
	this.findOne(query, (error, coupon) => {
		if (error) {
			throw error;
		}
		callback(error, coupon);
	});
});

module.exports = mongoose.model('Coupon', CouponSchema);
