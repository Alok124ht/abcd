import { model, Schema } from 'mongoose';
import { AttendanceStatus } from 'server/types/Attendance';
import { Lecture, LectureModelInterface } from '../../types/Lecture';

const LectureSchema = new Schema(
	{
		phase: {
			type: Schema.Types.ObjectId,
			ref: 'Phase',
			required: true,
		},
		subject: {
			type: Schema.Types.ObjectId,
			ref: 'Subject',
			required: true,
		},
		lecturers: [
			{
				type: Schema.Types.ObjectId,
				ref: 'User',
			},
		],
		date: { type: Date, required: true },
		label: String,
		stats: {
			[AttendanceStatus.Present]: Number,
			[AttendanceStatus.Absent]: Number,
			[AttendanceStatus.Leave]: Number,
			[AttendanceStatus.LatePresent]: Number,
			[AttendanceStatus.CasualLeave]: Number,
			[AttendanceStatus.SickLeave]: Number,
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

const LectureModel = model<Lecture, LectureModelInterface>(
	'Lecture',
	LectureSchema
);

export default LectureModel;
