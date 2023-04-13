import config from '../../config/config';
import { ENVIRONMENT } from '../../config/ENVIRONMENT';
import { Router } from 'express';
import auth from '../middleware/auth';
import { setUpCron } from './lib/cron';
import adminRoutes from './routes/admin';
import publicRoutes from './routes/public';

const router = Router();

router.use('/public', publicRoutes);

router.use('/admin', auth.required, auth.isSuper, adminRoutes);

if (config.env === ENVIRONMENT.prod) {
	setUpCron();
}

export default router;
