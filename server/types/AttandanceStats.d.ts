import { Document } from 'mongoose';
import { Attendance } from './Attendance';

export interface IAttendanceStats extends Document {
	attendance: Attendance;
	stats: {
		P?: number; // present
		A?: number; // absent
		LP?: number; // late present
		SL?: number; // sick leave
		CL?: number; // casual leave
		L?: number; // leave
		// I(Neel) know that only P and A is require for schools but we have to take them all in consideration as these 6 were defined in old schema
	};
	isArchived: boolean;
}
