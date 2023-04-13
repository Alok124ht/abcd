import { Document, Model, Types } from 'mongoose';

export interface Attendance extends Document {
	status: AttendanceStatus;
	user: Types.ObjectId;
	lecture: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}
export interface AttendanceModelInterface extends Model<Attendance> {}

export const enum AttendanceStatus {
	Present = 'P',
	Absent = 'A',
	SickLeave = 'SL',
	CasualLeave = 'CL',
	Leave = 'L',
	LatePresent = 'LP',
}
