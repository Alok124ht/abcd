const Razorpay = require('razorpay');
const Order = require('./models/Order');

const { sendPaymentSuccessEmail } = require('./utils');

const {
	validateAndCalculateCouponDiscount,
	verifyRazorpayPayment,
} = require('./utils');
const { createOrderRedirectHTML } =
	require('../payments/controllers/lib').default;

const razorpayInstance = new Razorpay({
	key_id: process.env.RAZOR_PAY_KEY_ID,
	key_secret: process.env.RAZOR_PAY_KEY_SECRET,
});

const getDiscount = (req, res) => {
	const { email, mobileNumber } = req.query;
	const { coupon, course } = res.locals;

	validateAndCalculateCouponDiscount(coupon, email, mobileNumber, course)
		.then((discount) => {
			res.send({
				price: course.originalPrice || course.price,
				discount,
				discountedPrice: course.price - discount,
			});
		})
		.catch((error) => {
			res.status(422).send({ message: 'Invalid code', error });
		});
};

const getPrice = (req, res) => {
	const { course } = res.locals;
	res.send({
		price: course.price,
		originalPrice: course.originalPrice,
		title: course.title,
		type: course.type,
		courses: course.courses,
	});
};

const createOrder = (req, res, next) => {
	const { email, mobileNumber, name, collegeName } = req.body;
	const { coupon, course } = res.locals;

	validateAndCalculateCouponDiscount(coupon, email, mobileNumber, course)
		.then((discount) => {
			const chargeableAmount = course.price - discount;
			const order = new Order({
				email,
				mobileNumber,
				name,
				collegeName,
				amount: chargeableAmount,
				course,
				// razorpayPaymentId,
				coupon,
				currency: course.currency,
			});
			razorpayInstance.orders
				.create({
					amount: order.amount,
					currency: order.currency,
					receipt: order._id.toString(),
				})
				.then((razorpayOrder) => {
					order.set('razorpayOrderId', razorpayOrder.id);
					order.save((saveError) => {
						if (saveError) {
							res.status(422).send({
								message: 'Error creating order.',
								error: saveError,
								order,
							});
						} else {
							// eslint-disable-next-line no-param-reassign
							res.locals.order = order;
							next();
							// res.send({ message: 'Order created successfully', orderId: order._id });
						}
					});
				})
				.catch((error) => {
					res
						.status(500)
						.send({ message: 'Error occurred while creating order', error });
				});
		})
		.catch((error) => {
			res.status(422).send({ message: 'Coupon validation failed', error });
		});
};

const startPayment = (req, res) => {
	const key = process.env.RAZOR_PAY_KEY_ID;
	const { order } = res.locals;
	const failureBaseUrl = `${process.env.API_BASE_HOST}${process.env.API_BASE_PATH}/p4/payment/failure?type=p4Course`;
	const callbackUrl =
		req.query.callbackUrl ||
		req.body.callbackUrl ||
		req.get('origin') ||
		'https://www.prepseed.com';
	const notes = { user: order.email };
	const prefill = {
		contact: order.mobileNumber,
		email: order.email,
	};
	const options = {
		key_id: key,
		amount: order.amount,
		order_id: order.razorpayOrderId,
		name: 'Prepseed',
		description: 'P4 Course/Session Payment',
		notes,
		prefill,
		callback_url: `${process.env.API_BASE_HOST}${process.env.API_BASE_PATH}/p4/payment/success?type=service&orderId=${order._id}&callbackUrl=${callbackUrl}`,
		cancel_url: `${failureBaseUrl}&type=service&orderId=${order._id}&callbackUrl=${callbackUrl}`,
	};
	const response = createOrderRedirectHTML(options);
	res.send(response);
};

const handlePaymentFailure = (req, res) => {
	let callbackUrl;
	try {
		callbackUrl = req.query.callbackUrl;
	} catch (e) {
		callbackUrl = '';
	}
	res.render('payment_failure', { redirectUrl: callbackUrl });
};

const handlePaymentSuccess = (req, res) => {
	const { orderId } = req.query;
	if (!orderId) {
		handlePaymentFailure(req, res);
		return;
	}
	const {
		razorpay_payment_id: razorpayPaymentId,
		razorpay_order_id: razorpayOrderId,
		razorpay_signature: razorpaySignature,
	} = req.body;

	Order.findOne({ _id: orderId, razorpayOrderId })
		.populate({
			path: 'course',
			populate: { path: 'courses', select: 'title' },
		})
		.exec((orderSearchError, order) => {
			if (!razorpaySignature || !razorpayOrderId || !razorpayPaymentId) {
				try {
					// eslint-disable-next-line no-param-reassign
					res.locals.redirectUrl = order.item.callbackUrl;
					// eslint-disable-next-line no-empty
				} catch (e) {}
				handlePaymentFailure(req, res);
			} else if (orderSearchError || !order) {
				res.status(500).send({ message: 'Order not found.' });
			} else {
				verifyRazorpayPayment({
					razorpayOrderId,
					razorpayPaymentId,
					razorpaySignature,
				})
					.then(() => {
						razorpayInstance.payments
							.capture(razorpayPaymentId, order.amount)
							.then(() => {
								order.set('status', 'paid');
								order.set('razorpayPaymentId', razorpayPaymentId);
								order.save((saveError) => {
									if (saveError) {
										throw saveError;
									} else {
										// eslint-disable-next-line no-param-reassign
										res.locals.redirectUrl = req.cookies.redirectUrl;

										let callbackUrl;
										try {
											callbackUrl = req.query.callbackUrl || req.body.callbackUrl;
										} catch (e) {
											callbackUrl = '';
										}

										res.render('p4_payment_success', {
											redirectUrl: callbackUrl,
											courseName: order.course.title,
											type: order.course.type,
											courses: order.course.courses,
										});
										sendPaymentSuccessEmail(order);
										// next();
									}
								});
							})
							.catch((error) => {
								// TODO: try to capture again for a better user experience
								// eslint-disable-next-line no-console
								console.error(error);
								let callbackUrl;
								try {
									callbackUrl = req.query.callbackUrl;
								} catch (e) {
									callbackUrl = '';
								}
								res.render('payment_failure', { redirectUrl: callbackUrl });
							});
					})
					.catch(() => {
						let callbackUrl;
						try {
							callbackUrl = req.query.callbackUrl;
						} catch (e) {
							callbackUrl = '';
						}
						res.render('payment_failure', { redirectUrl: callbackUrl });
					});
			}
		});
};

module.exports = {
	createOrder,
	startPayment,
	handlePaymentSuccess,
	handlePaymentFailure,
	getDiscount,
	getPrice,
};
