import { forEach, get } from 'lodash';
import { model, Schema } from 'mongoose';
import { Attendance, AttendanceModelInterface } from '../../types/Attendance';
import { attendanceStatuses } from '../utils';
import AttendanceStatsModel from './attendancestats.model';

const AttendanceSchema = new Schema(
	{
		lecture: { type: Schema.Types.ObjectId, ref: 'Lecture' },
		users: [
			{
				user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
				status: { type: String, enum: attendanceStatuses },
			},
		],
		phase: { type: Schema.Types.ObjectId, ref: 'Phase' },
		type: { type: String, default: 'lecture' },
		stats: { type: Schema.Types.ObjectId, ref: 'AttendanceStats' },
		createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
		client: { type: Schema.Types.ObjectId, ref: 'Client' },
		date: { type: Date, default: new Date() },
		isArchived: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

AttendanceSchema.post(/^update[One|Many]*$/, async function (this) {
	const stats: any = { P: 0, A: 0, LP: 0, L: 0, CL: 0, SL: 0 };
	forEach(this.users, (users) => {
		if (Object.keys(stats).includes(users.status)) stats[users.status] += 1;
		else stats[users.status] = 1;
	});

	if (this.stats) {
		await AttendanceStatsModel.updateOne(
			{ _id: this.stats },
			{ $set: { stats } }
		).exec();
	} else {
		await new AttendanceStatsModel({
			attendance: this._id,
			stats,
		}).save();
	}
});

const AttendanceModel = model<Attendance, AttendanceModelInterface>(
	'Attendance',
	AttendanceSchema
);

export default AttendanceModel;
