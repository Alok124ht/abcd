import { Document, Schema, Types, model } from 'mongoose';

interface CourseFeedback extends Document {
	submittedBy?: Types.ObjectId;
	user?: Types.ObjectId;
	userIp?: string;
	email: string;
	name: string;
	collegeName: string;
	profilePictureUrl: string;
	courseRelevancy: number;
	sessionRelevancy: number;
	likedMost: string;
	experience: string;
	recommendationLevel: number;
	createdAt: Date;
	updatedAt: Date;
}

const ObjectId = Schema.Types.ObjectId;

const CourseFeedbackSchema = new Schema(
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
		name: {
			type: String,
			required: true,
		},
		collegeName: {
			type: String,
			required: true,
		},
		profilePictureUrl: {
			type: String,
			required: true,
		},
		courseRelevancy: {
			type: Number,
			min: 1,
			max: 5,
		},
		sessionRelevancy: {
			type: Number,
			min: -1,
			max: 5,
		},
		likedMost: {
			type: String,
		},
		experience: {
			type: String,
			required: true,
		},
		recommendationLevel: {
			type: Number,
			required: true,
			min: 1,
			max: 10,
		},
		type: {
			type: String,
			default: 'course',
		},
	},
	{ timestamps: true }
);

export default model<CourseFeedback>('CourseFeedback', CourseFeedbackSchema);
