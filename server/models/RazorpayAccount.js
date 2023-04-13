import mongoose, { model } from 'mongoose';

const { Schema } = mongoose;
const { ObjectId } = Schema;

// this is used for transfers
const RazorpayAccountSchema = new Schema(
	{
		razorpayAccountId: { type: String, required: true, unique: true },
		merchant: { type: ObjectId, ref: 'Merchant' },
		name: {
			type: String,
			required: true,
		},
	},
	{ timestamps: true }
);

export default model('RazorpayAccount', RazorpayAccountSchema);
