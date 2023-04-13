import { Router } from 'express';
import { getPerformanceFiles } from './controllers/performanceMetrics';

const router = Router();
router.route('/performanceFiles').get(getPerformanceFiles);

export default router;
