import { Router } from 'express';
import auth from '../../middleware/auth';
import { getGroup } from './controllers/admin';
import { withClientOnlyIfModerator } from '../../client/middlewares';
import {
	createGroup,
	getNumberOfUsersOfGroup,
	getUserIdsOfGroup,
	listGroups,
} from './controllers/crud';
import { withAdminPermission } from '../../admin/permissions/middlewares';
import { addUsers, removeUsersFromGroup } from './controllers/user';

// eslint-disable-next-line new-cap
const router = Router();

// eslint-disable-next-line new-cap
const adminRouter = Router();

adminRouter.use(auth.required, auth.isAtLeastMentor);

adminRouter
	.route('/')
	.post(createGroup)
	.get(withClientOnlyIfModerator, getGroup);
adminRouter.route('/list').get(withAdminPermission, listGroups);
adminRouter
	.route('/group/count')
	.get(withAdminPermission, getNumberOfUsersOfGroup);
adminRouter
	.route('/group/userIds')
	.get(withClientOnlyIfModerator, getUserIdsOfGroup);

adminRouter.route('/add/users').post(withClientOnlyIfModerator, addUsers);
adminRouter
	.route('/remove/users')
	.post(withClientOnlyIfModerator, removeUsersFromGroup);

router.use('/admin', adminRouter);

export default router;
