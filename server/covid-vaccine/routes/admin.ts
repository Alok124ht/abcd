import { Router } from 'express';
import {
	createDistrictsDatabase,
	createStatesDatabase,
} from '../controllers/admin';

const router = Router();

router.route('/update-states').post(createStatesDatabase);
router.route('/update-districts').post(createDistrictsDatabase);

export default router;
