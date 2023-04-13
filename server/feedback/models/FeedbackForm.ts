import { model, Schema } from 'mongoose';
import {
	FeedbackForm,
	FeedbackFormModelInterface,
} from '../types/FeedbackForm';

const FeedbackFormSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
		},
		description: {
			type: String,
		},
		questionItems: [
			{
				text: String,
				disableTypedAnswer: Boolean,
				disableRating: Boolean,
			},
		],
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

const FeedbackFormModel = model<FeedbackForm, FeedbackFormModelInterface>(
	'FeedbackForm',
	FeedbackFormSchema
);

export default FeedbackFormModel;
