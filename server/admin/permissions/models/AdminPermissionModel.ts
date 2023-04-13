import { string } from 'joi';
import { Document, Model, Schema, model, Types } from 'mongoose';

/**
 * AdminPermission document contains information that admin or adminGroup can perform what actions on what
 */
const AdminPermissionSchema = new Schema(
	{
		grantedTo: {
			type: Schema.Types.ObjectId,
			refPath: 'grantedToModel',
			required: true,
		},
		grantedToModel: {
			type: String,
			enum: ['UserGroup', 'User'],
			required: true,
		},
		grantedOn: {
			type: Schema.Types.ObjectId,
			refPath: 'grantedOnModel',
			required: true,
		},
		grantedOnModel: {
			type: String,
			enum: ['Phase', 'UserGroup', 'User'],
			required: true,
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
	},
	{ timestamps: true }
);

interface AdminPermissionBase {
	grantedTo: Types.ObjectId;
	grantedToModel: 'UserGroup' | 'User';
	grantedOn: Types.ObjectId;
	grantedOnModel: 'Phase' | 'UserGroup' | 'User';
	createdBy: Types.ObjectId;
	createdAt?: Date;
	updatedAt?: Date;
}

interface AdminPermissionDocument extends AdminPermissionBase, Document {}
interface AdminPermissionModel extends Model<AdminPermissionDocument> {}

export default model<AdminPermissionDocument, AdminPermissionModel>(
	'AdminPermission',
	AdminPermissionSchema
);
