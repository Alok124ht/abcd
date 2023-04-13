import { model, Schema } from 'mongoose';
import {
	ForumCommentDocument,
	ForumCommentModelInterface,
} from '../types/ForumComment';

const ForumCommentSchema = new Schema(
	{
		item: {
			type: Schema.Types.ObjectId,
			required: true,
			refPath: 'itemType',
		},
		itemType: {
			type: String,
			required: true,
			enum: ['ForumQuestion', 'ForumAnswer'],
		},
		text: { type: String, required: true },
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
	},
	{ timestamps: true }
);

const ForumCommentModel = model<
	ForumCommentDocument,
	ForumCommentModelInterface
>('ForumComment', ForumCommentSchema);

export default ForumCommentModel;
