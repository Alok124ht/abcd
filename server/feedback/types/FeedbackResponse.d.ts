import { Document, Model, Types } from 'mongoose';

interface QuestionItemFeedback {
	typedAnswer: string;
	rating: 1 | 2 | 3 | 4 | 5;
}

interface FeedbackResponse extends Document {
	/**
	 * User who submitted the response
	 */
	user: Types.ObjectId;
	/**
	 * Phase of user
	 */
	// storing phase for query performance
	phase: Types.ObjectId;
	/**
	 * Form wrapper
	 */
	formWrapper: Types.ObjectId;
	otherRefs: {
		type: 'PlaylistItem' | 'Video' | 'ResourceDocument' | 'Assignment';
		value: Types.ObjectId;
	}[];
	responseByQuestionItemId: { [questionItemId: string]: QuestionItemFeedback };
	createdAt: Date;
	updatedAt: Date;
}

interface FeedbackResponseModelInterface extends Model<FeedbackResponse> {}
