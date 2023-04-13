import { Schema, model, Model, Document } from 'mongoose';

const VaccineUserSchema = new Schema(
	{
		name: {
			type: String,
		},
		email: {
			type: String,
			index: true,
		},
		emailIdentifier: {
			type: String,
			index: true,
		},
		mobileNumber: {
			type: String,
			index: true,
		},
	},
	{ timestamps: true }
);

export interface VaccineUserBase {
	name: string;
	email: string;
	emailIdentifier: string;
	mobileNumber?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface VaccineUser extends Document, VaccineUserBase {}

interface VaccineUserModel extends Model<VaccineUser> {}

export default model<VaccineUser, VaccineUserModel>(
	'VaccineUsers',
	VaccineUserSchema
);
