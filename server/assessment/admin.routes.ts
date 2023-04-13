import { Router } from 'express';
import { withAdminPermission } from '../admin/permissions/middlewares';
import auth from '../middleware/auth';
import {
	getWrapper,
	listWrappersAdmin,
	getSingleCore,
} from './controllers/admin/list';

const assessmentAdminRouter = Router();
assessmentAdminRouter.use(auth.required, auth.isAtLeastMentor);

assessmentAdminRouter
	.route('/wrapper/:wrapperId')
	.get(withAdminPermission, getWrapper);

assessmentAdminRouter.route('/listWrappersAdmin').post(listWrappersAdmin);

assessmentAdminRouter.route('/get-single-core/:id').get(getSingleCore);

export default assessmentAdminRouter;
