import { model, Schema } from 'mongoose';
import { ILeaves } from '../types/Leaves';
const {
	Types: { ObjectId },
} = Schema;

const schema = new Schema(
	{
		user: { type: ObjectId, ref: 'User', required: true },
		client: { type: ObjectId, ref: 'Client', required: true },
		fromDate: { type: Date, required: true },
		description: String,
		toDate: { type: Date, required: true },
		days: { type: Number, required: true },
		leavesStatus: {
			type: [
				{
					date: { type: Date, required: true },
					granted: { type: Boolean, default: false },
					rejected: { type: Boolean, default: false },
					actedby: { type: ObjectId, ref: 'User' },
					actedOn: Date,
					fullDay: Boolean,
					type: { type: String, default: 'unpaid' },
				},
			],
			required: true,
		},
	},
	{ timestamps: true }
);

const LeavesModel = model<ILeaves>('Leaves', schema);

export = LeavesModel;
