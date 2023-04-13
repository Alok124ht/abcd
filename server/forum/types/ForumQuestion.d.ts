import { Document, Model, Types } from 'mongoose';

interface ForumQuestionBase {
	title: string;
	body?: { text: string };
	bodyType: 'text';
	tags: {
		subjects: Types.ObjectId[];
	};
	files: {
		name: string;
		extension: string;
		type: string;
		url: string;
	}[];
	phase: Types.ObjectId;
	createdBy: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

interface ForumQuestionDocument extends Document, ForumQuestionBase {}

interface ForumQuestionModelInterface extends Model<ForumQuestionDocument> {}
