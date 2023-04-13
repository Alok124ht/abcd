import { Router } from 'express';
import { getAlertStatByKey } from '../controllers/alert';
import { getDistricts } from '../controllers/geo';
import { getMyAlerts, subscribe } from '../controllers/request';
import { getCenters } from '../controllers/search';
import { register as registerUser } from '../controllers/user';

const router = Router();
router.route('/subscribe').post(subscribe);
router.route('/search').post(getCenters).get(getCenters);
router.route('/districts').get(getDistricts);
router.route('/user/alerts').get(getMyAlerts);
router.route('/user/register').post(registerUser);
router.route('/alert').get(getAlertStatByKey);

export default router;
