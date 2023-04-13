import { Router } from 'express';
import {
	getUsers,
	getLastLogin,
	getRecentActivities,
	getUsersCreated,
	getWrappersCreated,
	getTotalSubmissions,
	getLearningCenterDetails,
	getAverageTimeSpentOnPortal,
} from './super.controller';

const superRouter = Router();

superRouter.route('/get-users').post(getUsers);

superRouter.route('/get-last-login/:user').get(getLastLogin);

superRouter.route('/get-recent-activity').post(getRecentActivities);

superRouter.route('/get-users-created').post(getUsersCreated);

superRouter.route('/get-wrappers-created').post(getWrappersCreated);

superRouter.route('/get-total-submissions').post(getTotalSubmissions);

superRouter
	.route('/get-learning-center-details')
	.post(getLearningCenterDetails);

superRouter
	.route('/get-average-time-spent-on-portal')
	.post(getAverageTimeSpentOnPortal);

export default superRouter;
