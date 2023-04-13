import { Types, Schema, model, Document } from 'mongoose';
import { IUser } from './IUser';

const ObjectId = Schema.Types.ObjectId;

interface TopicBaseData {
	id: string;
	'correct-too-fast': number;
	'correct-optimum': number;
	'correct-too-slow': number;
	'incorrect-too-fast': number;
	'incorrect-optimum': number;
	'incorrect-too-slow': number;
	unattempted: number;
}
export interface UserCategoryTopic extends TopicBaseData {
	subTopics: TopicBaseData[];
}

interface AssessmentCategoryData {
	assessment: Types.ObjectId;
	category: number;
	marks: number;
	correctBluffs: number;
	corrects: number;
	totalTooFastAttempts: number;
	totalAttempts: number;
	maxIdleTime: number;
	earlyExitTime: number;
	correctsInTime: number;
	allNotInTime: number;
	pickingAbility: number;
	selectivity: number;
	stamina: number;
	questionsStuckOn: number;
	patches: { activity: number; duration: number }[];
	duration: number;
	totalQuestions: number;
	tooSlowQuestionTimes: { [questionId: string]: number };
	topics: UserCategoryTopic[];
	migratedToSubKpiAt: Date;
	version: number;
}

export interface UserCategory extends Document {
	user: Types.ObjectId | IUser;
	calibrationDate: Date;
	category: number;
	unattempted: number;
	assessments: AssessmentCategoryData[];
}

const UserCategorySchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
			unique: true,
		},
		calibrationDate: {
			type: Date,
			default: Date.now,
		},
		category: {
			type: Number,
			default: 0,
		},
		assessments: [
			{
				assessment: {
					// required
					type: ObjectId,
					ref: 'AssessmentWrapper',
				},
				category: {
					type: Number,
				},
				marks: {
					type: Number,
					default: 0,
				},
				// new data
				correctBluffs: {
					// for br1. should be less han 40% for normal
					type: Number,
					default: 0,
				},
				corrects: {
					type: Number,
					default: 0,
				},
				totalTooFastAttempts: {
					// should be less than 40%
					type: Number,
					default: 0,
				},
				totalAttempts: {
					// should be more than 20% or 3 per test
					type: Number,
					default: 0,
				},
				maxIdleTime: {
					// should be less than max(10mins, 10%)
					type: Number,
					default: 0,
				},
				earlyExitTime: {
					// should not be more than 30%
					type: Number,
					default: 0,
				},
				correctsInTime: {
					type: Number,
					default: 0,
				},
				allNotInTime: {
					type: Number,
					default: 0,
				},
				pickingAbility: {
					type: Number,
					default: 0,
				},
				selectivity: {
					type: Number,
					default: 0,
				},
				stamina: {
					type: Number,
					default: 0,
				},
				questionsStuckOn: {
					// compare it with totalAttempts
					type: Number,
					default: 0,
				},
				patches: [
					{
						activity: Number,
						duration: Number,
					},
				],
				duration: {
					type: Number,
					default: 0,
				},
				totalQuestions: {
					type: Number,
					default: 0,
				},
				tooSlowQuestionTimes: Object,
				topics: [
					{
						id: String,
						'correct-too-fast': Number,
						'correct-optimum': Number,
						'correct-too-slow': Number,
						'incorrect-too-fast': Number,
						'incorrect-optimum': Number,
						'incorrect-too-slow': Number,
						unattempted: Number,
						subTopics: [
							{
								id: String,
								'correct-too-fast': Number,
								'correct-optimum': Number,
								'correct-too-slow': Number,
								'incorrect-too-fast': Number,
								'incorrect-optimum': Number,
								'incorrect-too-slow': Number,
								unattempted: Number,
							},
						],
					},
				],
				version: {
					type: Number,
					default: 1,
				},
			},
		],
		migratedToSubKpiAt: {
			type: Date,
		},
		version: { type: Number, default: 1 },
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

export default model<UserCategory>('Usercategory', UserCategorySchema);
