import { model, Schema } from 'mongoose';
import { IInventoryStockTransaction } from '../types/InventoryStockTransaction';

const {
	Types: { ObjectId },
} = Schema;

const schema = new Schema(
	{
		product: { type: ObjectId, ref: 'InventoryProducts', required: true },
		addedBy: { type: ObjectId, ref: 'User', required: true },
		quantity: { type: Number, required: true },
		client: { type: ObjectId, ref: 'Client', required: true },
	},
	{ timestamps: true }
);

const InventoryStockTransactionModel = model<IInventoryStockTransaction>(
	'InventoryStockTransaction',
	schema
);

export = InventoryStockTransactionModel;
