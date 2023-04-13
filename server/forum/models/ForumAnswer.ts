import { model, Schema } from 'mongoose';
import {
	ForumAnswerDocument,
	ForumAnswerModelInterface,
} from '../types/ForumAnswer';

const ForumAnswerSchema = new Schema(
	{
		question: {
			type: Schema.Types.ObjectId,
			required: true,
		},
		body: {
			text: {
				type: String,
			},
		},
		bodyType: {
			type: String,
			enum: ['text'],
		},
		files: [
			{
				name: String,
				extension: String,
				type: {
					type: String,
				},
				url: {
					type: String,
				},
			},
		],
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
	},
	{ timestamps: true }
);

const ForumAnswerModel = model<ForumAnswerDocument, ForumAnswerModelInterface>(
	'ForumAnswer',
	ForumAnswerSchema
);

export default ForumAnswerModel;
