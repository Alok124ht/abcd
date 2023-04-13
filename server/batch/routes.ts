import express from 'express';
import auth from '../middleware/auth';
import { create, list } from './controller';
import { withClientOnlyIfModerator } from '../client/middlewares';

const router = express.Router();
router.route('/').post(auth.required, auth.isModerator, create);
router
	.route('/list')
	.get(auth.required, auth.isModerator, withClientOnlyIfModerator, list);

export default router;
