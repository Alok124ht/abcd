import { Document, Types } from 'mongoose';

interface AssignmentSubmission {
	title: string;
	files: { url: string; name: string }[];
	comments: { text: string; user: Types.ObjectId }[];
	grades: {
		section: Types.ObjectId;
		marks: number;
	}[];
}

export interface AssignmentSubmissionDocument
	extends AssignmentSubmission,
		Document {
	user: Types.ObjectId;
	assignment: Types.ObjectId;
}
