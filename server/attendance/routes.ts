import { Router } from 'express';
import auth from '../middleware/auth';
import {
	createLecture,
	getLectueStats,
	getLectureAttendanceSheet,
	getUserAttendance,
	getAttendanceGraphData,
} from './controllers/crud';
import { markAttendance } from './controllers/mark';
import {
	copy,
	createScheduledLecture,
	getScheduledLecture,
	listScheduledLectures,
	listScheduledLecturesByLecturer,
	updateScheduledLecture,
} from './controllers/schedule';
import { getAllStatuses } from './controllers/status';

const attendanceRouter = Router();

attendanceRouter.use(auth.required);

attendanceRouter.route('/status/list').get(getAllStatuses);
attendanceRouter.route('/mark').post(auth.isAtLeastMentor, markAttendance);
attendanceRouter.route('/lecture').post(auth.isAtLeastMentor, createLecture);
attendanceRouter
	.route('/lecture-stats')
	.get(auth.isAtLeastMentor, getLectueStats);
attendanceRouter
	.route('/sheet')
	.get(auth.isAtLeastMentor, getLectureAttendanceSheet);

const scheduledLectureRouter = Router();
scheduledLectureRouter.route(`/get/:id`).get(getScheduledLecture);
scheduledLectureRouter.route(`/update/:id`).patch(updateScheduledLecture);
scheduledLectureRouter.route('/create').post(createScheduledLecture);
scheduledLectureRouter.route('/list').get(listScheduledLectures);
scheduledLectureRouter
	.route('/list-by-lecturer')
	.get(listScheduledLecturesByLecturer);
scheduledLectureRouter.route('/copy').post(copy);
attendanceRouter.use('/scheduled-lecture', scheduledLectureRouter);

attendanceRouter
	.route('/for-user/:id')
	.get(auth.isAtLeastMentor, getUserAttendance);

attendanceRouter
	.route('/graph')
	.get(auth.isAtLeastMentor, getAttendanceGraphData);

export default attendanceRouter;
