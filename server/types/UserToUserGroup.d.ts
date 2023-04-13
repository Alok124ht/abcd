import { Document, Model, Types } from 'mongoose';
interface UserToUserGroupBase {
	user: Types.ObjectId;
	group: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

interface UserToUserGroupDocument extends UserToUserGroupBase, Document {}

interface UserTouserGroupModel extends Model<UserToUserGroupDocument> {}
