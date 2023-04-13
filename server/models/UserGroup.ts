import { Schema, model } from 'mongoose';
import { UserGroupDocument, UserGroupModel } from '../types/UserGroup';

const { ObjectId } = Schema.Types;

const UserGroupSchema = new Schema(
	{
		client: {
			type: ObjectId,
			ref: 'Client',
		},
		createdBy: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		isTemporary: {
			type: Boolean,
			default: true,
		},
		label: {
			type: String,
			required: true,
		},
		version: {
			type: Number,
			default: 1,
		},
	},
	{ timestamps: true }
);

export default model<UserGroupDocument, UserGroupModel>(
	'UserGroup',
	UserGroupSchema
);
