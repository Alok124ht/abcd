import { model, Schema } from 'mongoose';
import { IBatch } from '../types/Batch';

const BatchSchema = new Schema(
	{
		name: {
			type: String,
		},
		client: {
			type: Schema.Types.ObjectId,
			ref: 'Client',
		},
	},
	{
		timestamps: true,
	}
);

export default model<IBatch>('Batch', BatchSchema);
