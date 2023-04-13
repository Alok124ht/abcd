import { model, Schema } from 'mongoose';
import {
	ScheduledLecture,
	ScheduledLectureModelInterface,
} from '../../types/ScheduledLecture';

const ScheduledLectureSchema = new Schema(
	{
		label: String,
		lecturer: { type: Schema.Types.ObjectId, ref: 'User', index: true },
		subject: { type: Schema.Types.ObjectId, ref: 'Subject', index: true },
		phases: {
			type: [{ type: Schema.Types.ObjectId, ref: 'Phase' }],
			index: true,
		},
		startTime: { type: Date, required: true },
		endTime: { type: Date, required: true },
		createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	},
	{ timestamps: true }
);

const ScheduledLectureModel = model<
	ScheduledLecture,
	ScheduledLectureModelInterface
>('ScheduledLecture', ScheduledLectureSchema);

export default ScheduledLectureModel;
