import { Router } from 'express';
import auth from '../../middleware/auth';
import { getApplications, updateNote, updateState } from './controller';
import { getCourseQueries } from './controllers/courseQuery';

const router = Router();
router.use(auth.isAdmin);

router.route('/application/note').patch(updateNote);
router.route('/application/state').patch(updateState);
router.route('/applications/list').get(getApplications);
router.route('/course-query/list').get(getCourseQueries);
export default router;
