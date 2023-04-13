import { Document, Schema, Types, model } from 'mongoose';

interface CourseQuery extends Document {
	submittedBy?: Types.ObjectId;
	user?: Types.ObjectId;
	userIp?: string;
	email: string;
	name: string;
	mobileNumber: string;
	createdAt: Date;
	updatedAt: Date;
}

const ObjectId = Schema.Types.ObjectId;

const CourseQuerySchema = new Schema(
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
		name: {
			type: String,
			required: true,
		},
		course: {
			type: ObjectId,
			ref: 'P4Course',
		},
	},
	{ timestamps: true }
);

export default model<CourseQuery>('CourseQuery', CourseQuerySchema);
