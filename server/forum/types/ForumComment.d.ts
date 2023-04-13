import { Document, Model, Types } from 'mongoose';

interface ForumCommentBase {
	item: Types.ObjectId;
	itemType: 'ForumQuestion' | 'ForumAnswer';
	text: string;
	createdBy: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

interface ForumCommentDocument extends Document, ForumCommentBase {}

interface ForumCommentModelInterface extends Model<ForumCommentDocument> {}
