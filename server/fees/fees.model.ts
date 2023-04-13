import { model, Schema } from 'mongoose';
import IFees from './Fees';

const {
	Types: { ObjectId },
} = Schema;

const schema = new Schema(
	{
		date: { type: Date, required: true, default: Date.now() },
		user: { type: ObjectId, ref: 'User', required: true },
		addedBy: { type: ObjectId, ref: 'User', required: true },
		amount: { type: Number, required: true },
		standerd: { type: String, required: true },
		division: { type: String, required: true },
		paidVia: { type: String, required: true },
		phase: { type: ObjectId, required: true, ref: 'Phase' },
		notes: String,
		checkNo: String,
		bank: String,
		upiId: String,
		transactionId: String,
		referenceId: String,
		feeType: { type: String, required: true },
		policy: { type: String },
	},
	{ timestamps: true }
);

const FeesModel = model<IFees>('Fees', schema);

export = FeesModel;
