import { Types, Model } from 'mongoose';
import { IAnswer, QuestionType, QuestionTypes } from './QuestionType';
import { Document } from 'mongoose';
import { QuerySelector } from 'mongodb';

interface Content {
	rawContent: string;
}

interface QuestionOption {
	_id?: Types.ObjectId;
	content: Content;
	isCorrect: boolean;
	votes?: number;
	isAlternateCorrect?: boolean;
}

interface QuestionAnswerRange {
	start: number;
	end: number;
}

export interface IQuestion extends Document {
	category: string;
	content: Content;
	answers: IAnswer[];
	type: QuestionTypes;
	options?: QuestionOption[];
	multiOptions?: QuestionOption[];
	integerAnswer: number;
	range: QuestionAnswerRange;
	level: number;
	randomId?: number;
	columns: {
		col1: [
			{
				content: any;
				matches: any;
			}
		];
		col2: [
			{
				content: any;
			}
		];
	};
	hint: Content;
	solution: Content;
	solSubmittedBy: Types.ObjectId;
	isVerified: boolean;
	verifiedBy: string;
	addedBy: Types.ObjectId;
	totalReviews: number;
	isReviewable: boolean;
	isPublished: boolean;
	isOriginal: boolean;
	tag: string;
	hasImage: boolean;
	hasEquation: boolean;
	topicId: number;
	topic: string;
	sub_topic: string;
	reports: any[];
	link: {
		content: Content;
		id: Types.ObjectId;
		sequence_no: number;
		total_questions: number;
	};
	used: string;
	usedIn: Types.ObjectId;
	dataType: 'text' | 'image';
	concepts: { concept: Types.ObjectId }[];
	statistics: Types.ObjectId;
	attemptsCount: number;
	version: 0 | 1 | 2;
	subTopic: string;
	isArchived: boolean;
	fixed: boolean;
	hiddenInSearch: boolean;
	client: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
	tags: { key: string; value: string }[];
	// methods
	fixContent: (this: IQuestion) => void;
	changeTypeToMultipleCorrect: (
		this: IQuestion,
		targetType: QuestionTypes,
		newOptions: QuestionOption[],
		content?: Content
	) => void;
	changeTypeToSingleCorrect: (
		this: IQuestion,
		targetType: QuestionTypes,
		newOptions?: QuestionOption[],
		content?: Content
	) => void;
	changeTypeToRange: (
		this: IQuestion,
		targetType: QuestionTypes,
		newRange: QuestionAnswerRange,
		content?: Content
	) => void;
	// virtuals
	getOptions: QuestionOption[];
}

// static methods for Model
export interface QuestionModel extends Model<IQuestion> {
	get(this: QuestionModel, id: string | Types.ObjectId): Promise<IQuestion>;
	getMany(
		this: QuestionModel,
		tag: string,
		subTopic: string,
		questionType: QuestionType | 'LINKED' | '',
		questionState: string,
		level: string | number,
		showHidden: any,
		skip: number,
		limit: number,
		clientId: string | RegExp | Types.ObjectId,
		dataType: string | RegExp | QuerySelector<RegExp | 'text' | 'image'>,
		tags: { key: string; value: string }[],
		concepts: any[],
		questionIds: any[]
	): Promise<{ questions: IQuestion[]; total: number }>;
}
