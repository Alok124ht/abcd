import { Document, Model, Types } from 'mongoose';
interface WrapperAnalysis extends Document {
	core: Types.ObjectId;
	bonus: any;
	marks: any[];
	hist: any[];
	topper: any;
	sections: {
		id: string;
		incorrect: number;
		correct: number;
		sumMarks: number;
		marks: any[];
		marksWithUser: any[];
		sumTime: number;
		hist: any[];
		times: any[];
	}[];
	difficulty: {
		(key: 'easy' | 'hard' | 'medium'): {
			correct: number;
			incorrect: number;
			time: number;
			totalAttempts: number;
			times: any[];
		};
	};
	sumMarks: number;
	sumAccuracy: number;
	sumSqAccuracy: number;
	liveAttempts: number;
	totalAttempts: number;
	attemptsSynced: number;
	submissions: Types.ObjectId[];
	processedAt: Date;
	createdAt: Date;
	updatedAt: Date;

	coreAnalysis: () => Promise<void>;
}

interface WrapperAnalysisModelInterface extends Model<WrapperAnalysis> {}
