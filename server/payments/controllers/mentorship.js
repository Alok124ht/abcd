const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../models/Order').default;
const Coupon = require('../../models/Coupon');
const MentorshipRequest = require('../../models/Mentor/Request');
const MentorshipType = require('../../models/Mentor/Type').default;
const { secureUser } = require('../../user/lib');
const {
	calculateDiscountForCoupon,
	createOrder,
	createOrderRedirectHTML,
	validateAndCalculateChargeableAmount,
} = require('./lib').default;

const razorpayInstance = new Razorpay({
	key_id: process.env.RAZOR_PAY_KEY_ID,
	key_secret: process.env.RAZOR_PAY_KEY_SECRET,
});
const handleRequestSuccessWithoutPaymentSuccess = (req, res) => {
	const { request, order, user } = res.locals;
	order.set('status', 'paid');
	order.save();
	request.order = order._id;
	request.state = 'pending';
	request.lifeCycle.push({ createdAt: Date.now(), state: 'pending' });
	request.save();
	if (order.xpUsed) {
		user.xp.used.push({
			xp: order.xpUsed,
			code: `order-${order._id}`,
		});
		user.save();
	}
	res
		.status(302)
		.set({
			Location: `${process.env.UI_MENTORSHIP_BASE_URL}/payment/success?requestId=${request._id}`,
		})
		.send('');
};

const startPaymentForMentorship = (req, res) => {
	const { request: requestId, xp: xpToUse, couponCode } = req.body;
	const { user } = res.locals;
	const securedUser = secureUser(user);
	const failureBaseUrl = `${process.env.API_BASE_HOST}${process.env.API_BASE_PATH}/payments/failure?requestId=${requestId}`;
	MentorshipRequest.findById(requestId)
		.populate('type')
		.exec((error, request) => {
			if (error) {
				res
					.status(302)
					.set({ Location: `${failureBaseUrl}&reason=notfound` })
					.send({
						message: 'Error searching mentorship request',
					});
			} else if (!request.type.available) {
				res
					.status(302)
					.set({
						Location: `${failureBaseUrl}&reason=typeunavailable`,
					})
					.send({
						message: 'The request type you are requesting for is unavailable.',
					});
			} else if (request.state !== 'created') {
				res
					.status(302)
					.set({
						Location: `${failureBaseUrl}&reason=statechanged`,
					})
					.send('');
			} else {
				const couponPromise = new Promise((resolve, reject) => {
					if (!couponCode) {
						resolve(null);
					} else {
						Coupon.findActiveCouponByCode(couponCode, (couponSearchError, coupon) => {
							if (couponSearchError || !coupon) {
								reject();
							} else {
								resolve(coupon);
							}
						});
					}
				});
				couponPromise
					.then((coupon) => {
						const {
							isValid,
							amount,
							xpDiscount,
							couponDiscount,
							error: validationError,
						} = validateAndCalculateChargeableAmount({
							securedUser,
							request,
							xpToUse,
							coupon,
						});
						if (!isValid) {
							res.status(422).send({
								message: validationError,
							});
							return;
						}

						createOrder({
							amount,
							currency: 'INR',
							xpUsed: xpToUse,
							coupon,
							user,
							item: request,
							xpDiscount,
							couponDiscount,
							itemModel: MentorshipRequest.modelName,
						})
							.then((order) => {
								if (order.amount) {
									const key = process.env.RAZOR_PAY_KEY_ID;
									const notes = { user: user._id };
									const prefill = {
										contact: user.mobileNumber,
										email: user.email,
									};
									const options = {
										key_id: key,
										amount: order.amount,
										order_id: order.razorpayOrderId,
										name: 'Prepseed',
										description: 'Request for a mentor',
										notes,
										prefill,
										callback_url: `${process.env.API_BASE_HOST}${process.env.API_BASE_PATH}/payments/success?requestId=${request._id}&orderId=${order._id}`,
										cancel_url: `${failureBaseUrl}&orderId=${order._id}`,
									};
									const response = createOrderRedirectHTML(options);
									res.send(response);
								} else {
									// eslint-disable-next-line no-param-reassign
									res.locals.order = order;
									// eslint-disable-next-line no-param-reassign
									res.locals.request = request;
									handleRequestSuccessWithoutPaymentSuccess(req, res);
								}
							})
							.catch((createOrderError) => {
								// eslint-disable-next-line no-console
								console.error(createOrderError);
								res.status(500).send({
									message: 'Some error occurred',
								});
							});
					})
					.catch(() => {
						res.status(422).send({ message: 'Invalid coupon' });
					});
			}
		});
};

const handlePaymentFailure = (req, res) => {
	const { requestId, orderId, reason, type } = req.query;
	const baseUrl =
		type === 'course'
			? process.env.UI_PREPATION_PORTAL_BASE_URL
			: process.env.UI_MENTORSHIP_BASE_URL;
	res
		.status(302)
		.set({
			Location: `${baseUrl}/payment/failure?requestId=${requestId}&orderId=${orderId}&reason=${reason}`,
		})
		.send('');
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
	if (!razorpaySignature || !razorpayOrderId || !razorpayPaymentId) {
		handlePaymentFailure(req, res);
		return;
	}
	Order.findOne({ _id: orderId, razorpayOrderId })
		.populate('item')
		.populate('user')
		.exec((orderSearchError, order) => {
			if (orderSearchError || !order) {
				res.status(500).send({ message: 'Order not found.' });
			} else {
				const message = `${razorpayOrderId}|${razorpayPaymentId}`;
				const generatedSignature = crypto
					.createHmac('sha256', process.env.RAZOR_PAY_KEY_SECRET)
					.update(message)
					.digest('hex');
				if (generatedSignature === razorpaySignature) {
					razorpayInstance.payments
						.capture(razorpayPaymentId, order.amount)
						.then(() => {
							order.set('status', 'paid');
							order.set('razorpayPaymentId', razorpayPaymentId);
							order.save();
							order.item.set('state', 'pending');
							order.item.lifeCycle.push({
								state: 'pending',
								createdAt: Date.now(),
							});
							order.item.set('order', order._id);
							order.item.save();
							if (order.xpUsed) {
								order.user.xp.used.push({
									xp: order.xpUsed,
									code: `order-${order._id}`,
								});
								order.user.save();
							}
							res
								.status(302)
								.set({
									Location: `${process.env.UI_MENTORSHIP_BASE_URL}/payment/success?requestId=${order.item._id}`,
								})
								.send('');
						})
						.catch((e) => {
							// eslint-disable-next-line no-console
							console.error(e);
							res.status(500).send({
								message: 'Some error occurred while receiving payment',
							});
						});
				} else {
					res.status(422).send({
						message: 'Unable to verify payment, invalid data.',
					});
				}
			}
		});
};

const getDiscountedPrice = (req, res) => {
	const { user } = res.locals;
	const { couponCode, type: typeId, xpToUse } = req.query;
	Coupon.findActiveCouponByCode(couponCode, (error, coupon) => {
		if (error || !coupon) {
			res.status(422).send({ message: 'Invalid coupon' });
		} else {
			MentorshipType.findById(typeId, (typeSearchError, type) => {
				if (typeSearchError) {
					res.status(422).send({
						message: 'Invalid Mentorship type',
					});
				} else {
					const { isValid, discount } = calculateDiscountForCoupon({
						coupon,
						user,
						xpToUse,
						item: type,
					});
					if (isValid) {
						res.send({
							discount,
						});
					} else {
						res.status(422).send({ message: 'Invalid coupon' });
					}
				}
			});
		}
	});
};

module.exports = {
	startPaymentForMentorship,
	handlePaymentSuccess,
	handlePaymentFailure,
	getDiscountedPrice,
};
