import { Router } from 'express';
import auth from '../../middleware/auth';
import { getMyAccount, switchUser } from '../controllers/userAccount';

const router = Router();

router.route('/my-account').get(auth.required, getMyAccount);

router.route('/switch-user').post(auth.required, switchUser);

export default router;
