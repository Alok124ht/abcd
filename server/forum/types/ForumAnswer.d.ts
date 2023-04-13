import { Document, Model, Types } from 'mongoose';

interface ForumAnswerBase {
	question: Types.ObjectId;
	body?: { text: string };
	bodyType: 'text';
	files: {
		name: string;
		extension: string;
		type: string;
		url: string;
	}[];
	createdBy: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

interface ForumAnswerDocument extends Document, ForumAnswerBase {}

interface ForumAnswerModelInterface extends Model<ForumAnswerDocument> {}
