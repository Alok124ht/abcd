const express = require('express');
const businessClientAPIController = require('../controllers/businessClientAPI');

// eslint-disable-next-line new-cap
const router = express.Router();

router
	.route('/add')
	.post(
		businessClientAPIController.validateClientToken,
		businessClientAPIController.addUserServicePlan
	);

module.exports = router;
