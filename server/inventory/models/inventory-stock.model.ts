import { Schema, model } from 'mongoose';
import IInventoryStock from '../types/InventoryStock';

const {
	Types: { ObjectId },
} = Schema;

const schema = new Schema(
	{
		product: { type: ObjectId, ref: 'InventoryProducts', required: true },
		client: { type: ObjectId, ref: 'Client', required: true },
		quantity: { type: Number, required: true },
		addedBy: {
			type: [
				{
					user: { type: ObjectId, ref: 'User', required: true },
					date: { type: Date, default: new Date() },
				},
			],
			required: true,
		},
	},
	{ timestamps: true }
);

const InventoryStockModel = model<IInventoryStock>('InventoryStock', schema);

export = InventoryStockModel;
