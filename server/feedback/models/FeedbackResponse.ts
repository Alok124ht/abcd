import { model, Schema } from 'mongoose';
import {
	FeedbackResponse,
	FeedbackResponseModelInterface,
} from '../types/FeedbackResponse';

const FeedbackResponseSchema = new Schema(
	{
		user: {
			type: Schema.Types.ObjectId,
			index: true,
		},
		phase: {
			type: Schema.Types.ObjectId,
			index: true,
		},
		formWrapper: {
			type: Schema.Types.ObjectId,
			index: true,
		},
		otherRefs: [
			{
				type: {
					type: String,
					enum: ['PlaylistItem', 'Video', 'ResourceDocument', 'Assignment'],
				},
				value: { type: Schema.Types.ObjectId, refPath: 'otherRefs.type' },
			},
		],
		responseByQuestionItemId: Schema.Types.Mixed,
	},
	{ timestamps: true }
);

const FeedbackResponseModel = model<
	FeedbackResponse,
	FeedbackResponseModelInterface
>('FeedbackResponse', FeedbackResponseSchema);

export default FeedbackResponseModel;
