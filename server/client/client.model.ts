import { Schema, model } from 'mongoose';
import { Client, ClientModelInterface } from '../types/Client';
import { permissionIds } from './constants';

const { ObjectId } = Schema.Types;
const ClientSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		phases: [
			{
				type: ObjectId,
				ref: 'Phase',
			},
		],
		moderators: [
			{
				type: ObjectId,
				ref: 'User',
			},
		],
		support: {
			emails: [String],
		},
		accessToken: {
			type: String,
		},
		jwtSecret: {
			type: String,
		},
		logo: String,
		razorpayAccounts: [{ type: ObjectId, ref: 'RazorpayAccount' }],
		merchants: [{ type: ObjectId, ref: 'Merchant' }],
		permissions: [{ id: { type: String, enum: permissionIds } }],
		urls: {
			portals: [String],
			websites: [String],
		},
	},
	{ timestamps: true }
);

const ClientModel = model<Client, ClientModelInterface>('Client', ClientSchema);

export default ClientModel;
