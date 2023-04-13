// eslint-disable-next-line new-cap
const router = require('express').Router();
const auth = require('../middleware/auth').default;
const controller = require('./controllers');

router.route('/activeUsers').get(auth.isSuper, controller.getActiveUsers);
router.route('/userSignUps').get(auth.isSuper, controller.getSignUpReport);
router.route('/goal').get(auth.isSuper, controller.getUsersWithGoal);
router.route('/practice').get(auth.isSuper, controller.getPracticeReport);
router
	.route('/user-performance')
	.get(auth.isSuper, controller.getUserPerformanceReport);

router.route('/user-growth-rate').get(controller.getUserGrowth);

module.exports = router;
