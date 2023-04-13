const express = require('express');
const auth = require('../../middleware/auth').default;

const {
	createRazorpayAccount,
	createServiceProviders,
	getAllRazorpayAccounts,
	getServiceProviders,
} = require('../controllers/serviceProvider');

// eslint-disable-next-line
const router = express.Router();

/**
 * Creation routes
 */
router
	.route('/razorpay-account/create')
	.post(auth.required, auth.createRoleValidator('super'), createRazorpayAccount);

router
	.route('/provider-of-service/create')
	.post(
		auth.required,
		auth.createRoleValidator('super'),
		createServiceProviders
	);

/**
 * Get data
 */

router
	.route('/razorpay-accounts')
	.get(auth.required, auth.createRoleValidator('super'), getAllRazorpayAccounts);

router
	.route('/service-providers')
	.get(auth.required, auth.createRoleValidator('super'), getServiceProviders);

module.exports = router;
