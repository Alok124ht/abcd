import { Router } from 'express';
import { temp } from './controllers/selectivity';
import { sendTestEmail } from './controllers/email';
import { setRedisDate, getRedisDate } from './controllers/redis';
import { getCachedSubGroup } from './controllers/subGroup';
import { query, get } from './controllers/dynamodb';
import { fixMissingAttempts } from './controllers/question';
import { testWrapperAnalysis } from './controllers/assessment';

const router = Router(); // eslint-disable-line new-cap
router.get('/selectivity', temp);
router.post('/send_test_email', sendTestEmail);
router.post('/redis-test', setRedisDate);
router.get('/redis-test', getRedisDate);
router.get('/subgroup', getCachedSubGroup);
router.get('/fixMissingAttempts', fixMissingAttempts);

router.route('/dynamo/query').get(query);
router.route('/dynamo').get(get);
router.route('/wrapperAnalysis').get(testWrapperAnalysis);

export default router;
