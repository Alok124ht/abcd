// eslint-disable-next-line new-cap
const router = require('express').Router();
const {
	createUserServicePlan,
	getUserServicePlan,
	getUserServicePlans,
	getUserServicePlansForService,
	removeUserServicePlan,
	issueServicePlanToUsers,
} = require('../controllers/userServicePlan');
const auth = require('../../middleware/auth').default;
const phaseMiddlewares = require('../../phase/middlewares');
/**
 * Only authenticated requests should be sent to sub-routes
 */
router.use(auth.required, auth.isModerator, phaseMiddlewares.withPhases);

router.route('/').get(getUserServicePlans);
router.route('/create').post(createUserServicePlan);
router.route('/issueServicePlanToUsers').post(issueServicePlanToUsers);
router.route('/remove').post(removeUserServicePlan);
router.route('/download-purchases-of-service').get(
	auth.required,
	auth.isModerator,
	phaseMiddlewares.withPhases,
	(req, res, next) => {
		// eslint-disable-next-line no-param-reassign
		res.locals.additionalQuery = { phase: { $in: res.locals.phases } };
		// eslint-disable-next-line no-param-reassign
		res.locals.hasAccess = true;
		next();
	},
	getUserServicePlansForService
);
router.route('/:userServicePlanId').get(getUserServicePlan);

module.exports = router;
