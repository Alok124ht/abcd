import { model, Schema } from 'mongoose';
import IInventoryVendor from '../types/InventoryVendor';

const {
	Types: { ObjectId },
} = Schema;

const schema = new Schema(
	{
		name: { type: String, required: true },
		email: String,
		contactNo: String,
		website: String,
		otherEmails: [String],
		otherMobiles: [String],
		socialHandles: [
			{
				key: { type: String, required: true },
				value: { type: String, required: true },
			},
		],
		address: {
			type: {
				line1: { type: String, required: true },
				line2: String,
				area: { type: String, required: true },
				city: { type: String, required: true },
				state: String,
				country: { type: String, default: 'India' },
				pincode: { type: String, required: true },
			},
			required: false,
		},
		brands: [{ type: ObjectId, ref: 'InventoryBrands', required: true }],
		createdBy: { type: ObjectId, ref: 'User', required: true },
		client: { type: ObjectId, ref: 'Client' },
		isArchived: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

const InventoryVendorModel = model<IInventoryVendor>('InventoryVendor', schema);

export = InventoryVendorModel;
