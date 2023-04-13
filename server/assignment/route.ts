import express from 'express';
import adminRouter from './routes/admin';
import publicRouter from './routes/public_endpoint';
import auth from '../middleware/auth';

const router = express.Router();
router.use('/admin', auth.required, auth.isAtLeastMentor, adminRouter);
router.use('/public', auth.required, publicRouter);

export default router;
