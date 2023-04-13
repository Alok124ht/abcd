import { model, Schema } from 'mongoose';
import { IInventoryProducts } from '../types/InventoryProducts';

const {
	Types: { ObjectId },
} = Schema;

const schema = new Schema(
	{
		name: { type: String, required: true },
		description: String,
		client: { type: ObjectId, ref: 'Client' },
		price: Number, // in paisaa
		oldPrices: [{ price: Number, effectiveTill: Date }],
		qrcode: String,
		createdBy: { type: ObjectId, required: true, ref: 'User' },
		isArchived: { type: Boolean, default: false },
		brand: { type: ObjectId, ref: 'InventoryBrands', required: true },
		image: String,
	},
	{ timestamps: true }
);

const InventoryProductModel = model<IInventoryProducts>(
	'InventoryProducts',
	schema
);

export = InventoryProductModel;
