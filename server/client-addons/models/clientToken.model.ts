import { Schema, model } from 'mongoose';
import { IClientToken } from '../types/ClientToken';

const ClientTokenSchema = new Schema(
	{
		client: {
			type: Schema.Types.ObjectId,
			ref: 'clients',
			required: true,
		},
		token: {
			type: 'string',
			required: true,
		},
		active: {
			type: 'boolean',
			required: true,
			default: true,
		},
	},
	{
		timestamps: true,
	}
);

export const ClientTokenModel = model<IClientToken>(
	'clienttokens',
	ClientTokenSchema
);
