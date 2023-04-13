import { Document, Schema, Types, model } from 'mongoose';

export const enum ApplicationState {
	applyStep1Completed = 'Apply Step 1 Completed',
	applied = 'Applied',
	rejected = 'Rejected',
	assignmentSent = 'Assignment Sent',
	assignmentSubmitted = 'Assignment Submitted',
	interviewScheduled = 'Interview Scheduled',
	prepleafAccepted = 'Prepleaf Accepted',
	studentRegistered = 'Student Registered',
}

export const applicationStateValues: string[] = [
	ApplicationState.applyStep1Completed,
	ApplicationState.applied,
	ApplicationState.rejected,
	ApplicationState.assignmentSent,
	ApplicationState.assignmentSubmitted,
	ApplicationState.interviewScheduled,
	ApplicationState.prepleafAccepted,
	ApplicationState.studentRegistered,
];

const enum PaymentMethod {
	monthly = 'monthly',
	prepaid = 'prepaid',
	postpaid = 'postpaid',
}

const paymentMethodValues: string[] = [
	PaymentMethod.monthly,
	PaymentMethod.prepaid,
	PaymentMethod.postpaid,
];

interface ApplicationStateHistoryItem {
	state: ApplicationState;
	createdAt: Date;
}

interface ApplicationNoteHistoryItem {
	note: string;
	createdAt: Date;
}

interface CourseApplication extends Document {
	submittedBy?: Types.ObjectId;
	user?: Types.ObjectId;
	userIp?: string;
	email: string;
	name: string;
	paymentMethod?: string;
	collegeName: string;
	course?: Types.ObjectId;
	mobileNumber: string;
	cvUrl?: string;
	experienceYears?: number;
	graduationYear?: number;
	grades: number;
	createdAt: Date;
	updatedAt: Date;
	password?: string;
	state: ApplicationState;
	stateHistory: ApplicationStateHistoryItem[];
	note: string;
	noteHistory: ApplicationNoteHistoryItem[];
	experiences: string;
}

const ObjectId = Schema.Types.ObjectId;

const CourseApplicationSchema = new Schema(
	{
		/**
		 * If it was submitted by a used logged in
		 */
		submittedBy: {
			type: ObjectId,
			ref: 'User',
		},
		/**
		 * If email matches some user
		 */
		user: {
			type: ObjectId,
			ref: 'User',
		},
		userIp: {
			type: String,
		},
		email: {
			type: String,
			required: true,
		},
		mobileNumber: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			required: true,
		},
		collegeName: {
			type: String,
			// required: true,
		},
		cvUrl: {
			type: String,
			// required: true,
		},
		experienceYears: {
			type: Number,
			// required: true,
		},
		course: {
			type: ObjectId,
			ref: 'P4Course',
		},
		courseName: {
			type: String,
			enum: ['analytics-and-data-science'],
		},
		paymentMethod: {
			type: String,
			enum: paymentMethodValues,
		},
		experiences: String,
		graduationYear: {
			type: Number,
		},
		grades: { type: Number },
		state: {
			type: String,
			enum: applicationStateValues,
			default: ApplicationState.applied,
		},
		stateHistory: [
			{
				state: String,
				createdAt: Date,
			},
		],
		note: {
			type: String,
		},
		noteHistory: [
			{
				note: String,
				createdAt: Date,
			},
		],
		password: String,
	},
	{ timestamps: true }
);

export default model<CourseApplication>(
	'CourseApplication',
	CourseApplicationSchema
);
