import { model, Schema } from 'mongoose';
import { IInventoryBrand } from '../types/InventoryBrand';

const {
	Types: { ObjectId },
} = Schema;

const schema = new Schema(
	{
		name: { type: String, required: true },
		image: String,
		client: { type: ObjectId, ref: 'Client' },
		createdBy: { type: ObjectId, ref: 'User', required: true },
		isArchived: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

const InventoryBrandModel = model<IInventoryBrand>('InventoryBrands', schema);

export = InventoryBrandModel;
