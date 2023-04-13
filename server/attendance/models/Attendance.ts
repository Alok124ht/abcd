import { model, Schema } from 'mongoose';
import { Attendance, AttendanceModelInterface } from '../../types/Attendance';
import { attendanceStatuses } from '../utils';

const AttendanceSchema = new Schema(
	{
		lecture: {
			type: Schema.Types.ObjectId,
			ref: 'Lecture',
			required: true,
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		status: {
			type: String,
			enum: attendanceStatuses,
		},
	},
	{ timestamps: true }
);

AttendanceSchema.index({ lecture: -1, user: -1 }, { unique: true });

const AttendanceModel = model<Attendance, AttendanceModelInterface>(
	'Attendance',
	AttendanceSchema
);

export default AttendanceModel;
