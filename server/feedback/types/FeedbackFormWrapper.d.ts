import { Document, Model, Types } from 'mongoose';

type SupportedFeedbackItemTypes = 'Playlist';

export const enum FeedbackFormTrigger {
	/**
	 * Just after video completes, ask for the feedback
	 */
	VideoEnd = 'VideoEnd',
	/**
	 * Visible before user has watched the video
	 */
	BeforeVideoWatch = 'BeforeVideoWatch',
	/**
	 * Visible after user has watched the video
	 */
	AfterVideoWatch = 'AfterVideoWatch',

	/**
	 * Just after assignment is submitted
	 */
	OnAssignmentSubmission = 'OnAssignmentSubmission',
	/**
	 * Visible after assignment has been submitted
	 */
	AfterAssignmentSubmission = 'AfterAssignmentSubmission',
	/**
	 * Show on Document Download
	 */

	OnDocumentDownload = 'OnDocumentDownload',
	/**
	 * After user has dowloaded the document
	 */
	AfterDocumentDownload = 'AfterDocumentDownload',
}

interface FeedbackFormWrapper extends Document {
	item: Types.ObjectId;
	itemRef: SupportedFeedbackItemTypes;
	/**
	 * self when it is for itself
	 * child when it for one of items inside it
	 */
	formFor: 'self' | 'child';
	form: Types.ObjectId;
	/**
	 * Enables filters
	 */
	hasFiltersEnabled: boolean;
	/**
	 * By default it will be visible
	 */
	filters: [
		{
			type: 'Phase';
			value: Types.ObjectId;
			triggers: FeedbackFormTrigger[];
		}
	];
	createdBy: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

interface FeedbackFormWrapperModelInterface
	extends Model<FeedbackFormWrapper> {}
