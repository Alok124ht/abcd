import { model, Model, Schema } from 'mongoose';
import Razorpay from 'razorpay';
import { Merchant } from '../types/Merchant';

const MerchantSchema = new Schema(
	{
		razorpayMerchantId: { type: String, required: true, unique: true },
		apiKeyId: {
			type: String,
		},
		apiKeySecret: {
			type: String,
		},
		name: {
			type: String,
			required: true,
		},
		isDefault: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

MerchantSchema.method(
	'getRazorpayInstance',
	function getRazorpayInstance(this: Merchant) {
		return new Razorpay({ key_id: this.apiKeyId, key_secret: this.apiKeySecret });
	}
);

export default model<Merchant>('Merchant', MerchantSchema);
