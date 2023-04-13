import { Router } from 'express';
import auth from '../middleware/auth';
import {
	addAttendance,
	addUserToAttendance,
	changeIndividualStatus,
	changeVisibility,
	getAttendances,
	getMyAttendance,
	getPhaseInfo,
	getStatistics,
	getUsersAttendance,
	removeUserFromAttendance,
	updateAttendanceMeta,
	updateWholeAttendanceUsers,
} from './controller';
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
attendanceRouter.route('/get=phase-info').get(getPhaseInfo);
attendanceRouter.use(auth.required);
attendanceRouter.route('/status/list').get(getAllStatuses);
attendanceRouter.route('/mark').post(auth.isAtLeastMentor, markAttendance);
attendanceRouter.route('/lecture').post(auth.isAtLeastMentor, createLecture);
attendanceRouter.route('/lecture-stats').get(auth.required, getLectueStats);
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

attendanceRouter
	.route('/new')
	.post(auth.isAtLeastMentor, addAttendance)
	.get(getAttendances);

attendanceRouter
	.route('/new/get-my-attendance')
	.get(auth.required, getMyAttendance);

attendanceRouter.route('/new/get-user-attendance').get(getUsersAttendance);

attendanceRouter
	.route('/new/change-status')
	.get(auth.isAtLeastMentor, changeIndividualStatus);

attendanceRouter
	.route('/new/change-users')
	.post(auth.isAtLeastMentor, updateWholeAttendanceUsers);

attendanceRouter
	.route('/new/update-with-key')
	.post(auth.isAtLeastMentor, updateAttendanceMeta);

attendanceRouter
	.route('/new/get-statistics')
	.get(auth.isAtLeastMentor, getStatistics);

attendanceRouter
	.route('/new/change-visibility')
	.get(auth.isAtLeastMentor, changeVisibility);

attendanceRouter
	.route('/new/users')
	.get(auth.isAtLeastMentor, removeUserFromAttendance)
	.post(auth.isAtLeastMentor, addUserToAttendance);

export default attendanceRouter;
