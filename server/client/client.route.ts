import { Router } from 'express';
import {
	listClients,
	addClient,
	updateSupport,
	updatePhases,
	addModerator,
	getMyRazorpayAccounts,
	addRazorpayAccountToClient,
	getPhasesOfClient,
	getMyClient,
	getAllPermissions,
	updatePermission,
} from './client.controller';
import { withClient } from './middlewares';
import auth from '../middleware/auth';
import { associateMerchant, getMerchants } from './controllers/merchant';
import { updateInformation } from './controllers/edit';

const router = Router(); // eslint-disable-line new-cap

router.route('/list').get(auth.isAdmin, listClients);

router.route('/add').post(auth.isAdmin, addClient);
router.route('/support').patch(auth.isSuper, updateSupport);

router.route('/update-phases').post(auth.isAdmin, updatePhases);

router.route('/moderator').post(auth.isSuper, addModerator);

router.route('/razorpayAccounts').get(getMyRazorpayAccounts);
router.route('/razorpayAccount').post(auth.isSuper, addRazorpayAccountToClient);

router.route('/merchants').get(auth.isModerator, getMerchants);
router.route('/merchant/associate').post(auth.isSuper, associateMerchant);

router
	.route('/phases-with-subgroups')
	.get(auth.isModerator, withClient, getPhasesOfClient);

router.route('/my-client').get(auth.isModerator, withClient, getMyClient);

router.route('/get-all-permissions').get(auth.isSuper, getAllPermissions);
router.route('/update-permissions').post(auth.isSuper, updatePermission);

router.route('/update-information').patch(auth.isSuper, updateInformation);

export default router;
