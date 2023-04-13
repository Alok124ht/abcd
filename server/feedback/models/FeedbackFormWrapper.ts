import { model, Schema } from 'mongoose';
import {
	FeedbackFormWrapper,
	FeedbackFormWrapperModelInterface,
} from '../types/FeedbackFormWrapper';

const FeedbackFormWrapperSchema = new Schema(
	{
		item: {
			type: Schema.Types.ObjectId,
			refPath: 'itemRef',
		},
		itemRef: {
			type: String,
			enum: ['Playlist'],
		},
		formFor: {
			type: String,
			enum: ['self', 'child'],
		},
		form: {
			type: Schema.Types.ObjectId,
			ref: 'FeedbackForm',
		},
		hasFiltersEnabled: Boolean,
		filters: [
			{
				type: {
					type: String,
					enum: ['Phase'],
				},
				value: Schema.Types.ObjectId,
				triggers: [String],
			},
		],
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

const FeedbackFormWrapperModel = model<
	FeedbackFormWrapper,
	FeedbackFormWrapperModelInterface
>('FeedbackFormWrapper', FeedbackFormWrapperSchema);

export default FeedbackFormWrapperModel;
