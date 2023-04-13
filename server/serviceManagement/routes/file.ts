import express from 'express';
import auth from '../../middleware/auth';
import { getUploadPolicy } from '../controllers/file';

const router = express.Router();

router.route('/policy').post(auth.required, auth.isModerator, getUploadPolicy);

export default router;
