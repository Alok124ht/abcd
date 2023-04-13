const express = require('express');
const auth = require('../middleware/auth').default;
const {
	createOrUpdateCoupon,
	getAllCouponsForAdmin,
} = require('./controllers/coupon');
const {
	getServicePlans,
	getServicePlansByPhase,
	getServicePlansByUser,
	getServices,
	getServicePlansForPhases,
} = require('./controllers/service.controller');

const isAdmin = auth.createRoleValidator('admin');

const {
	startPaymentForMentorship,
	handlePaymentSuccess,
	handlePaymentFailure,
	getDiscountedPrice,
} = require('./controllers/mentorship');

const {
	createServiceRequest,
	getDiscountedAmount,
	handlePaymentSuccess: handleServicePlanRequestPaymentSuccess,
	handlePaymentFailure: handleServicePlanRequestPaymentFailure,
	renderPaymentSuccessPage,
	startPaymentFlowForServicePlanRequest,
	createOrderForServiceCart,
	startPaymentForOrder,
} = require('./controllers/serviceRequest.controller');

const serviceProviderRoutes = require('./routes/serviceProvider');
const clientServiceRoutes = require('./routes/clientService');
const clientCourseRoutes = require('./routes/clientCourse');
const serviceAdminRoutes = require('./routes/serviceAdmin');
const couponRoutes = require('./routes/coupon');
const offerRoutes = require('./routes/offer');
const merchantRoutes = require('./routes/merchant').default;
const csp = require('../middleware/csp');

// eslint-disable-next-line
const router = express.Router();
router.use('/service-provider-management', serviceProviderRoutes);
router.use('/service/admin', serviceAdminRoutes);

router.use('/client/course', clientCourseRoutes);
router.use('/client/service', clientServiceRoutes);
router.use('/merchant/admin', merchantRoutes);

router
	.route('/mentor/request')
	.post(auth.required, auth.withUser, startPaymentForMentorship);
router.route('/success').post(handlePaymentSuccess);
router.route('/failure').get(handlePaymentFailure);
router
	.route('/coupon/check')
	.get(auth.required, auth.withUser, getDiscountedPrice);

router.use('/coupon-management', couponRoutes);

router
	.route('/coupon')
	.post(auth.required, isAdmin, createOrUpdateCoupon)
	.patch(auth.required, isAdmin, createOrUpdateCoupon);

router.route('/coupon/all').get(auth.required, isAdmin, getAllCouponsForAdmin);

router.use('/offer', offerRoutes);

router
	.route('/service/request/coupon/check')
	.get(auth.required, auth.withUser, getDiscountedAmount);
router.route('/service/request').post(auth.required, createServiceRequest);

router
	.route('/service/request/pay')
	.post(
		auth.required,
		csp.paymentPage,
		auth.withUser,
		startPaymentFlowForServicePlanRequest
	);

router
	.route('/service/request/pay/success')
	.post(handleServicePlanRequestPaymentSuccess, renderPaymentSuccessPage);

router
	.route('/service/request/after-success')
	.get(auth.required, auth.withUser, auth.refreshToken, (req, res) => {
		res.redirect(req.query.redirectUrl);
	});

router
	.route('/service/request/pay/failure')
	.get(handleServicePlanRequestPaymentFailure);

router
	.route('/service/list')
	.get(auth.required, auth.createRoleValidator('admin'), getServices);

// router
// 	.route('/service/create')
// 	.post(auth.required, auth.createRoleValidator('admin'), createService);

router
	.route('/service/plan/list')
	.get(auth.required, auth.createRoleValidator('admin'), getServicePlans);

// router
// 	.route('/service/plan/create')
// 	.post(auth.required, auth.createRoleValidator('admin'), createServicePlan);

/**
 * Public Routes
 */

router
	.route('/service/plan/list/for-phases')
	.get(getServicePlansForPhases)
	.post(getServicePlansForPhases);

router
	.route('/service/plan/list/:phase')
	.get(auth.required, getServicePlansByPhase);

router
	.route('/service/plan/list/user/:userId')
	.get(auth.required, getServicePlansByUser);

router
	.route('/service/order/pay')
	.post(auth.required, auth.withUser, csp.paymentPage, startPaymentForOrder);
router
	.route('/service/order/cart/create')
	.post(auth.required, auth.withUser, createOrderForServiceCart);

module.exports = router;
