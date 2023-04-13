import { Router } from 'express';
import auth from '../../middleware/auth';
import { getUserInformation } from '../controllers/adminReport';

const router = Router();

router.use(auth.required, auth.isModerator);

router.route('/get-information').get(auth.isSuper, getUserInformation);

export default router;
