import { Router } from 'express';
import { withCourse, withCoupon } from './middlewares';
import {
	getPrice,
	getDiscount,
	createOrder,
	startPayment,
	handlePaymentSuccess,
	handlePaymentFailure,
} from './controller';
import auth from '../middleware/auth';
import {
	createCoupon,
	createCourse,
	deleteCoupon,
	getAllCoupons,
	getAllCourses,
	getAllRegistrationsForCourse,
	markPaymentCapturedManually,
	updateCoupon,
	updateCourse,
} from './adminController';
import { getEvents } from './controllers/eventAdmin';
import {
	getQuestion,
	createQuestion,
	updateQuestion,
	listQuestions,
	createOption,
	updateOption,
	createQuestionnaire,
} from './controllers/questionnaire.admin';
import { list } from './controllers/feedback';
import { paymentPage } from '../middleware/csp';

// eslint-disable-next-line new-cap
const router = Router();

router.route('/price').get(withCourse, withCoupon, getPrice);
router.route('/discount').get(withCourse, withCoupon, getDiscount);

router
	.route('/pay')

	.post(withCourse, withCoupon, createOrder, paymentPage, startPayment);

router.route('/payment/success').post(paymentPage, handlePaymentSuccess);
router.route('/payment/failure').get(paymentPage, handlePaymentFailure);

/**
 * Admin endpoints starts here
 */
router
	.route('/course')
	.post(auth.required, auth.isAdmin, createCourse)
	.patch(auth.required, auth.isAdmin, updateCourse)
	.get(auth.required, auth.isAdmin, getAllCourses);

router
	.route('/coupon')
	.post(auth.required, auth.isAdmin, createCoupon)
	.delete(auth.required, auth.isAdmin, deleteCoupon)
	.patch(auth.required, auth.isAdmin, updateCoupon);

router
	.route('/registrations')
	.get(auth.required, auth.isAdmin, getAllRegistrationsForCourse);

router
	.route('/download/coupons')
	.get(auth.required, auth.isAdmin, getAllCoupons);
router
	.route('/order/mark-paid')
	.patch(auth.required, auth.isAdmin, markPaymentCapturedManually);

router.route('/events').get(auth.required, auth.isAdmin, getEvents);

router.route('/feedback/list').get(auth.required, auth.isAdmin, list);

/**
 * Admin endpoints ends here
 */

/**
 * Questionnaire admin endpoints starts here
 */
// eslint-disable-next-line new-cap
const questionnaireRouter = Router();
questionnaireRouter.use(auth.required, auth.isAdmin);
router.use('/questionnaire-admin', questionnaireRouter);

questionnaireRouter
	.route('/question')
	.get(getQuestion)
	.post(createQuestion)
	.patch(updateQuestion);

questionnaireRouter.route('/questions').get(listQuestions);

questionnaireRouter.route('/option').post(createOption).patch(updateOption);

questionnaireRouter.route('/').post(createQuestionnaire);

export default router;
