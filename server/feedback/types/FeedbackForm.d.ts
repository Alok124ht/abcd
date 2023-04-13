import { Document, Model, Types } from 'mongoose';

interface FeedbackQuestion {
	_id?: Types.ObjectId;
	/**
	 * Question text
	 */
	text: string;
	/**
	 * Disable writing text feedback
	 */
	disableTypedAnswer: boolean;
	/**
	 * Disable number rating
	 */
	disableRating: boolean;
}

interface FeedbackForm extends Document {
	title: string;
	description?: string;
	questionItems: FeedbackQuestion[];
	createdBy: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

interface FeedbackFormModelInterface extends Model<FeedbackForm> {}
