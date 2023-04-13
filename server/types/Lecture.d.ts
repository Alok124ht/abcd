import { Document, Model, Types } from 'mongoose';
import { AttendanceStatus } from './Attendance';

interface Lecture extends Document {
	phase: Types.ObjectId;
	subject: Types.ObjectId;
	date: Date;
	label: string;
	stats: {
		[AttendanceStatus.Present]: number;
		[AttendanceStatus.Absent]: number;
		[AttendanceStatus.LatePresent]: number;
		[AttendanceStatus.Leave]: number;
		[AttendanceStatus.CasualLeave]: number;
		[AttendanceStatus.SickLeave]: number;
	}[];
	lecturers: Types.ObjectId[];
	createdBy: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}
interface LectureModelInterface extends Model<Lecture> {}
