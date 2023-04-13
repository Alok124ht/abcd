import { Document, Model, Types } from 'mongoose';
import { IUser } from '../user/IUser';
import { IAttendanceStats } from './AttandanceStats';
import { Client } from './Client';

export interface Attendance extends Document {
	users: {
		user: Types.ObjectId;
		status: AttendanceStatus;
	}[];
	lecture: Types.ObjectId;
	phase: Types.ObjectId;
	type: string;
	date: Date;
	stats: IAttendanceStats;
	client: Client;
	createdBy: IUser;
	createdAt: Date;
	updatedAt: Date;
	isArchived: boolean;
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
