import { Document, Schema, model, Model, Types } from 'mongoose';

export interface SubmissionKPIBase {
	assessmentWrapper: Types.ObjectId;
	submission: Types.ObjectId;
	user: Types.ObjectId;
	category: number;
	/**
	 * Max marks of assessment
	 */
	maxMarks: number;
	/**
	 * Marks Scored for submission
	 */
	marks: number;

	selectivity: number;
	stamina: number;
	endurance: number;
	intent: number;

	// correctBluffs: number;
	// corrects: number;
	// totalTooFastAttempts: number;
	totalAttempts: number;
	// maxIdleTime: number;
	// earlyExitTime: number;
	// correctsInTime: number;
	// allNotInTime: number;
	// questionsStuckOn: number;
	// duration: number;
	totalQuestions: number;
}

interface SubmissionKPI extends SubmissionKPIBase, Document {}

interface SubmissionKPIModelInterface extends Model<SubmissionKPI> {}

const SubmissionKPISchema = new Schema(
	{
		assessmentWrapper: {
			// required
			type: Schema.Types.ObjectId,
			ref: 'AssessmentWrapper',
		},
		submission: {
			type: Schema.Types.ObjectId,
			ref: 'Submission',
			unique: true,
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},
		category: {
			type: Number,
		},
		maxMarks: {
			type: Number,
		},
		marks: {
			type: Number,
			default: 0,
		},
		endurance: { type: Number, default: 0 },
		selectivity: {
			type: Number,
			default: 0,
		},
		stamina: {
			type: Number,
			default: 0,
		},
		intent: {
			type: Number,
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
		questionsStuckOn: {
			// compare it with totalAttempts
			type: Number,
			default: 0,
		},
		duration: {
			type: Number,
			default: 0,
		},
		totalQuestions: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: true,
	}
);

const SubmissionKPIModel = model<SubmissionKPI, SubmissionKPIModelInterface>(
	'SubmissionKPI',
	SubmissionKPISchema
);

export default SubmissionKPIModel;
