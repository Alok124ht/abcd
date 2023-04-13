import { Schema, model } from 'mongoose';
import Discount from '../../models/Discount';

const { ObjectId } = Schema.Types;

const CoursePlanSchema = new Schema({
	code: { type: String, required: true },
	courses: [{ type: ObjectId, ref: 'P4Course' }],
	emails: {
		type: [{ type: String, required: true }],
	},
	maxUsageLimit: {
		type: Number,
		default: -1,
	},
	maxUsagePerEmail: {
		type: Number,
		default: -1,
	},
	discount: {
		type: Discount,
		required: true,
	},
});

CoursePlanSchema.methods.calculateDiscount = function calculateDiscount(price) {
	return this.discount.calculate(price);
};

export default model('P4Coupon', CoursePlanSchema);
