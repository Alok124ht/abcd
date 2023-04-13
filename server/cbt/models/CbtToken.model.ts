import { model, Schema } from 'mongoose';
import { ICBTTokens } from '../types/CBTTokens';

const schema = new Schema(
	{
		client: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'clients',
		},
		token: {
			type: String,
			required: true,
		},
		active: {
			type: Boolean,
			required: true,
			default: true,
		},
	},
	{
		timestamps: true,
	}
);

export const CbtTokenModel = model<ICBTTokens>('cbttokens', schema);
