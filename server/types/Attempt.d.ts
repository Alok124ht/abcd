import { Document, Model, Types } from 'mongoose';

interface Answer {
	type: 'option' | 'options' | 'number';
	data: any;
}

interface AnswerSelectionFlow extends Answer {
	createdAt: Date;
}

interface AttemptBase {
	user: Types.ObjectId;
	mode: string;
	reference: Types.ObjectId;
	onModel: 'AssessmentWrapper' | 'Session';
	batch: number;
	answer: Answer;
	isAnswered: boolean;
	isCorrect: boolean;
	startTime: Date;
	endTime: Date;
	flow: { startTime: Date; endTime: Date }[];
	answerSelectionFlow: AnswerSelectionFlow[];
	isSkipped: boolean;
	time: number;
	speed: number;
	isBookmarked: boolean;
	xpEarned: boolean;
	perfectTimeLimits: { min: number; max: number };
	median: number;
	demoRank: number;
	version: 1 | 2;
	createdAt?: Date;
	updatedAt?: Date;
}

interface QuestionPopulatedAttempt extends AttemptBase, Document {
	question: Document;
}

export interface AttemptModel extends Model<Attempt> {
	addAttempt(
		userId: Types.ObjectId,
		question: { question: Types.ObjectId; startTime: Date }
	): Promise<Attempt>;
}

export interface Attempt extends AttemptBase, Document {
	question: Types.ObjectId;
}
