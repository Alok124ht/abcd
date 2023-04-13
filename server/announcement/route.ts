import { Router } from 'express';
import auth from '../middleware/auth';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';

const router = Router();

router.use('/admin', auth.required, auth.isAtLeastMentor, adminRoutes);
router.use('/user', auth.required, userRoutes);

export default router;
