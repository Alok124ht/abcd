import { Router } from 'express';
import {
	downloadQuestionTopicsOfAssessment,
	fixMissingAttempts,
	getAttemptStartedInPeriod,
	getSubmissionResponseCSV,
} from './controller';
import courseRoutes from './course/route';
import { clearCache, getItemFromRedis } from './misc/redis';
import permissionRoute from './permissions/route';
import subjectRouter from './subject/routes';

const router = Router();
router.route('/fix-missing-attempts').get(fixMissingAttempts);
router.route('/attempts-started-in-period').get(getAttemptStartedInPeriod);

router.route('/getSubmissionResponseCSV').get(getSubmissionResponseCSV);
router
	.route('/download-question-topics-of-assessment')
	.get(downloadQuestionTopicsOfAssessment);

router.route('/item-from-redis').get(getItemFromRedis);
router.route('/clear-redis-key').post(clearCache);

router.use('/course', courseRoutes);
router.use('/permission', permissionRoute);
router.use('/subject', subjectRouter);

export default router;
