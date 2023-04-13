import Router from 'express';
import auth from '../middleware/auth';
import {
	actOnSingleLeaveGroup,
	changeLeaveStatus,
	listLeaves,
	request,
	requests,
	upcomingLeaves,
} from './leaves.controller';

const leaveRouter = Router();

leaveRouter.use(auth.required);

leaveRouter
	.route('/request')
	.post(request)
	.put(changeLeaveStatus)
	.get(requests);

leaveRouter.route('/act-on-leave').get(actOnSingleLeaveGroup);

leaveRouter.route('/').get(listLeaves);

leaveRouter.route('/upcoming').get(upcomingLeaves);

export default leaveRouter;
