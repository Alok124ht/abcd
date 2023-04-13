import { Document, Schema, Types, model } from 'mongoose';

interface CoachingDemoRequestDocument extends Document {
	submittedBy?: Types.ObjectId;
	user?: Types.ObjectId;
	userIp?: string;
	email: string;
	mobileNumber: string;
	coachingName: string;
	logoUrl: string;
	createdAt: Date;
	updatedAt: Date;
}

const ObjectId = Schema.Types.ObjectId;

const CoachingDemoRequestSchema = new Schema(
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
		},
		mobileNumber: {
			type: String,
		},
		coachingName: {
			type: String,
		},
		logoUrl: {
			type: String,
		},
	},
	{ timestamps: true }
);

const CoachingDemoRequestModel = model<CoachingDemoRequestDocument>(
	'CoachingDemoRequest',
	CoachingDemoRequestSchema
);

export default CoachingDemoRequestModel;
