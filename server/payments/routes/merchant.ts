import express from 'express';
import auth from '../../middleware/auth';
import {
	createMerchant,
	listMerchants,
	markMerchantDefault,
	updateMerchant,
} from '../controllers/merchant';

const router = express.Router();

router.use(auth.required);

router.route('/create').post(auth.isSuper, createMerchant);
router.route('/list').get(auth.isSuper, listMerchants);
router.route('/update').patch(auth.isSuper, updateMerchant);
router.route('/markDefault').patch(auth.isSuper, markMerchantDefault);

export default router;
