import { Attendance, AttendanceStatus } from '../../types/Attendance';
import AttendanceModel from '../models/Attendance';
import LectureModel from '../models/Lecture';

export async function markAttendance(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const { lecture, status, user } = req.body;
	try {
		let attendanceItem: Attendance;
		const attendanceItemPrev = await AttendanceModel.findOne({ lecture, user });
		if (attendanceItemPrev) {
			const prevStatus = attendanceItemPrev.status;
			attendanceItemPrev.status = status;
			await attendanceItemPrev.save();
			await LectureModel.update(
				{ _id: lecture },
				{
					$inc: {
						[`stats.${status}`]: 1,
						[`stats.${prevStatus}`]: -1,
					},
				}
			).exec();
			attendanceItem = attendanceItemPrev;
		} else {
			const attendanceItemNew = new AttendanceModel({
				lecture,
				status,
				user,
			});
			await attendanceItemNew.save();
			await LectureModel.update(
				{ _id: lecture },
				{
					$inc: {
						[`stats.${status}`]: 1,
					},
				}
			).exec();
			attendanceItem = attendanceItemNew;
		}
		res.send(attendanceItem);
	} catch (e) {
		next(e);
	}
}
