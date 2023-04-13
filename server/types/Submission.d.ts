import { Model, Types, Document } from 'mongoose';
import { IUser } from '../user/IUser';

interface FlowItem {
	id: number;
	section: number;
	question: number;
	time: number;
	action: number;
	state: number;
	response: any;
	endTime?: number;
}

export interface SubmissionMeta {
	correctQuestions: number;
	correctTime: number;
	firstSeenCorrect: number;
	firstSeenIncorrect: number;
	firstSeenSkip: number;
	firstSeenTime: number;
	incorrectQuestions: number;
	incorrectTime: number;
	marks: number;
	marksAttempted: number;
	marksGained: number;
	marksLost: number;
	percent: number;
	percentile: number;
	precision: number;
	questionsAttempted: number;
	rank: number;
	unattemptedTime: number;
	difficulty: {
		[level: string]: {
			correct: number;
			incorrect: number;
			time: number;
			totalAttempts: number;
		};
	};
	sections: { questions: { question: any }[] }[];
}
interface SubmissionBase {
	flow: FlowItem[];
	response: any;
	originalResponse: any;
	meta: SubmissionMeta;
	recommendations: any;
	roadmap: any;
	graded: boolean;
	live: boolean;
	isCategorized: boolean;
	messages: { type: string; message: string }[];
	version: number;
	attemptsUpdated: boolean;
	ignore: boolean;
	sEvent: 'clock' | 'user' | 'assessment';
	createdAt: Date;
	updatedAt: Date;
}

export interface ISubmission extends Document, SubmissionBase {
	assessment: string | Types.ObjectId;
	assessmentWrapper: string | Types.ObjectId;
	assessmentCore: string | Types.ObjectId;
	wrapperAnalysis: string | Types.ObjectId;
	coreAnalysis: string | Types.ObjectId;
	user: string | Types.ObjectId;
	submittedBy: Types.ObjectId;
}

export interface UserPopulatedSubmission extends Document, SubmissionBase {
	assessment: Types.ObjectId;
	assessmentWrapper: Types.ObjectId;
	assessmentCore: Types.ObjectId;
	wrapperAnalysis: Types.ObjectId;
	coreAnalysis: Types.ObjectId;
	user: IUser;
}

export interface SubmissionModel extends Model<ISubmission> {
	getAllGraded2(
		ids: (string | Types.ObjectId)[]
	): Promise<UserPopulatedSubmission[]>;
	getAllGraded(
		this: SubmissionModel,
		id: string | Types.ObjectId,
		populate: any
	): Promise<ISubmission[]>;
}
