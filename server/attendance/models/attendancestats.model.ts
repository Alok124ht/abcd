import { model, Schema } from 'mongoose';
import { IAttendanceStats } from '../../types/AttandanceStats';

const schema = new Schema(
	{
		attendance: { type: Schema.Types.ObjectId, ref: 'Attendance' },
		stats: {
			P: Number, // present
			A: Number, // absent
			CL: Number, // casual leave
			L: Number, // leave
			LP: Number, // late present
			SL: Number, // sick leave
			// I(Neel) know that only P and A is require for schools but we have to take them all in consideration as these 6 were defined in old schema
		},
		isArchived: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

const AttendanceStatsModel = model<IAttendanceStats>('AttendanceStats', schema);

export = AttendanceStatsModel;
