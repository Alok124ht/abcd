import { Document } from 'mongoose';

interface MerchantBase {
	razorpayMerchantId: string;
	apiKeyId: string;
	apiKeySecret: string;
	name: string;
	isDefault: boolean;
	createdAt: Date;
	updatedAt: Date;
}

interface Merchant extends MerchantBase, Document {
	getRazorpayInstance(this: Merchant): any;
}
