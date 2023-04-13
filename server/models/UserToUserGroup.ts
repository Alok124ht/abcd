import { Document, Model, Schema, Types, model } from 'mongoose';
import {
	UserToUserGroupDocument,
	UserTouserGroupModel,
} from '../types/UserToUserGroup';

const { ObjectId } = Schema.Types;
const UserToUserGroupSchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
		},
		group: {
			type: ObjectId,
			ref: 'UserGroup',
		},
	},
	{ timestamps: true }
);

export default model<UserToUserGroupDocument, UserTouserGroupModel>(
	'UserToUserGroup',
	UserToUserGroupSchema
);
