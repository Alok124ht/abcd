import { Schema, model } from 'mongoose';
import { AssignmentSubmissionDocument } from '../types/AssignmentSubmission';

const { ObjectId } = Schema.Types;

const AssignmentSubmissionSchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		assignment: {
			type: ObjectId,
			ref: 'Assignment',
			required: true,
		},
		files: [
			{
				url: String,
				name: String,
			},
		],
		grades: [
			{
				section: ObjectId,
				marks: Number,
			},
		],
		comments: [
			{
				text: String,
				user: ObjectId,
				createdAt: {
					type: Date,
					default: Date.now,
				},
			},
		],
	},
	{ timestamps: true }
);

const AssignmentSubmissionModel = model<AssignmentSubmissionDocument>(
	'AssignmentSubmission',
	AssignmentSubmissionSchema
);

export default AssignmentSubmissionModel;
