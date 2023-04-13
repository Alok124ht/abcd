import { model, Schema } from 'mongoose';
import {
	ForumQuestionDocument,
	ForumQuestionModelInterface,
} from '../types/ForumQuestion';

const ForumQuestionSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
		},
		body: {
			text: { type: String },
		},
		bodyType: {
			type: String,
			enum: ['text'],
		},
		tags: {
			subjects: [
				{
					type: Schema.Types.ObjectId,
					ref: 'Subject',
				},
			],
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
		phase: {
			type: Schema.Types.ObjectId,
			ref: 'Phase',
			// required for phase level discussions
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

const ForumQuestionModel = model<
	ForumQuestionDocument,
	ForumQuestionModelInterface
>('ForumQuestion', ForumQuestionSchema);

export default ForumQuestionModel;
