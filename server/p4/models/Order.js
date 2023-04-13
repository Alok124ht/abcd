const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const OrderSchema = new Schema(
	{
		email: {
			type: String,
			required: true,
		},
		mobileNumber: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			required: true,
		},
		collegeName: {
			type: String,
			required: true,
		},
		course: {
			type: ObjectId,
			ref: 'P4Course',
		},
		courses: [
			{
				type: ObjectId,
				ref: 'P4Course',
			},
		],
		amount: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			enum: ['INR'],
		},
		razorpayOrderId: {
			type: String,
		},
		razorpayPaymentId: {
			type: String,
		},
		status: {
			type: String,
			enum: ['created', 'attempted', 'paid'],
			required: true,
			default: 'created',
		},
		coupon: {
			type: ObjectId,
			ref: 'P4Coupon',
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model('P4Order', OrderSchema);
