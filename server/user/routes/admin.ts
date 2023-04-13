import { Router } from 'express';
import auth from '../../middleware/auth';
import { updateUserSubjectsBulk } from '../controllers/admin/userSubject';

const userAdminRouter = Router();

userAdminRouter.use(auth.required, auth.isAtLeastMentor);

userAdminRouter.route('/user-subjects-bulk').patch(updateUserSubjectsBulk);

export default userAdminRouter;
