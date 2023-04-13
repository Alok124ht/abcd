const express = require('express');
const controller = require('../controllers/serviceAdmin');
const auth = require('../../middleware/auth').default;

// eslint-disable-next-line new-cap
const router = express.Router();

router
	.route('/list')
	.get(
		auth.required,
		auth.createRoleValidator('moderator'),
		controller.withPhases,
		controller.getServiceList
	);

router
	.route('/plan/list')
	.get(
		auth.required,
		auth.createRoleValidator('moderator'),
		controller.withPhases,
		controller.getServicePlanList
	);

router
	.route('/plan/create')
	.post(
		auth.required,
		auth.createRoleValidator('moderator'),
		controller.withPhases,
		controller.validateServiceAccess,
		controller.createServicePlan
	);
router
	.route('/plan/update')
	.post(
		auth.required,
		auth.createRoleValidator('moderator'),
		controller.withPhases,
		controller.validateServiceAccess,
		controller.updateServicePlan
	);

router
	.route('/plan/delete')
	.post(
		auth.required,
		auth.createRoleValidator('moderator'),
		controller.withPhases,
		controller.deleteServicePlan
	);

router
	.route('/plan/restore')
	.post(
		auth.required,
		auth.createRoleValidator('moderator'),
		controller.withPhases,
		controller.restoreServicePlan
	);

router
	.route('/create')
	.post(
		auth.required,
		auth.createRoleValidator('moderator'),
		controller.withPhases,
		controller.createService
	);
router
	.route('/update')
	.post(
		auth.required,
		auth.createRoleValidator('moderator'),
		controller.withPhases,
		controller.updateService
	);
router
	.route('/accessKey')
	.post(
		auth.required,
		auth.createRoleValidator('moderator'),
		controller.withPhases,
		controller.createServiceAccessKey
	);

module.exports = router;
