import { Document, Types, Schema, model } from 'mongoose';
import { FlowItem } from '../types/Submission';

const { Mixed, ObjectId } = Schema.Types;

export interface IUserLiveAssessment extends Document {
	user: Types.ObjectId;
	assessmentWrapperId: Types.ObjectId;
	startTime: Date;
	duration: number;
	flow: FlowItem[];
	createdAt: Date;
	updatedAt: Date;
	deviceId: string;
}

const UserLiveAssessmentSchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
			unique: true,
		},
		assessmentWrapperId: {
			type: ObjectId,
			ref: 'AssessmentWrapper',
			default: null,
		},
		startTime: {
			type: Date,
			default: null,
		},
		duration: {
			// if time exceeds more than duration, auto submit submission!!
			type: Number,
			default: 0,
		},
		flow: [
			{
				id: Number,
				section: Number,
				question: Number,
				endTime: Number,
				time: Number,
				action: Number,
				state: Number,
				response: Mixed,
			},
		],
		deviceId: String,
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

export default model<IUserLiveAssessment>(
	'UserLiveAssessment',
	UserLiveAssessmentSchema
);
