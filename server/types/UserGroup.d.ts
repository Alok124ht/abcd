import { Document, Model, Types } from 'mongoose';

interface UserGroupBase {
	client: Types.ObjectId;
	createdBy: Types.ObjectId;
	isTemporary: boolean;
	label: string;
	createdAt: Date;
	updatedAt: Date;
	version: number;
}

interface UserGroupDocument extends UserGroupBase, Document {}

interface UserGroupModel extends Model<UserGroupDocument> {}
