import { Router } from 'express';
import auth from '../middleware/auth';
import { send } from './controller';

const router = Router();

router.route('/send').post(auth.required, auth.isModerator, send);

export default router;
