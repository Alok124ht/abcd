import { Router } from 'express';
import { withAdminPermission } from '../admin/permissions/middlewares';
import auth from '../middleware/auth';
import { getWrapper } from './controllers/admin/list';

const assessmentAdminRouter = Router();
assessmentAdminRouter.use(auth.required, auth.isAtLeastMentor);

assessmentAdminRouter
	.route('/wrapper/:wrapperId')
	.get(withAdminPermission, getWrapper);

export default assessmentAdminRouter;
