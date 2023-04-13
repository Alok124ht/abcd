import { Types, Document, Model } from 'mongoose';
import { AssessmentCoreInterface } from './AssessmentCore';

type Difficulty = {
	correct: number;
	incorrect: number;
	time: number;
	times: any[];
	totalAttempts: number;
};

export interface CoreSectionAnalysis {
	id: string;
	questions: {
		id: string;
		sumSqTime: number;
		sumTime: number;
		correctAttempts: number;
		totalAttempts: number;
		times: any[];
	}[];
	incorrect: number;
	correct: number;
	sumMarks: number;
	maxMarks: number;
	sumTime: number;
	marks: number;
	hist: number;
	times: any[];
}

export interface CoreAnalysisInterface extends Document {
	marks: any[];
	hist: any[];
	sections: CoreSectionAnalysis[];
	difficulty: {
		easy: Difficulty;
		medium: Difficulty;
		hard: Difficulty;
	};
	maxMarks: number;
	sumMarks: number;
	sumAccuracy: number;
	sumSqAccuracy: number;
	sumPickingAbility: number;
	sumSqPickingAbility: number;
	totalAttempts: number;
	lastSynced: Date;
	lastCategorized: Date;
	submissions: { submission: Types.ObjectId }[];
	createdAt: Date;
	updatedAt: Date;
}

export interface CoreAnalysisModelInterface
	extends Model<CoreAnalysisInterface> {
	getBestQuestionGroupChoices(
		assessmentCore: AssessmentCoreInterface
	): number[][][];
}
