const crypto = require('crypto');
const { every, map, some } = require('lodash');
const logger = require('../../../config/winston').default;
const Order = require('../../models/Order').default;
const OrderGroup = require('../../models/OrderGroup');
const Offer = require('../../models/Offer').default;
const ServicePlan = require('../../models/ServicePlan').default;
const ServicePlanRequest = require('../../models/ServicePlanRequest');
const { secureUser } = require('../../user/lib');
const {
	// createOrderRedirectHTML,
	createOrder,
	createOrderRedirectHTML,
	validateAndCalculateChargableAmountForServiceRequest,
	// calculateDiscountForCoupon,
} = require('./lib').default;
const Coupon = require('../../models/Coupon');
const { refreshToken } = require('../../middleware/auth').default;
const { getBaseApi } = require('../../utils/env');
const { default: Merchant } = require('../../models/Merchant');

const verifyRazorpayPayment = ({
	razorpayOrderId,
	razorpayPaymentId,
	razorpaySignature,
	razorpayApiKeySecret,
}) =>
	new Promise((resolve, reject) => {
		const message = `${razorpayOrderId}|${razorpayPaymentId}`;
		const generatedSignature = crypto
			.createHmac('sha256', razorpayApiKeySecret)
			.update(message)
			.digest('hex');
		if (generatedSignature === razorpaySignature) {
			resolve();
		} else {
			reject(
				new Error('Failed to verify payment. Payment Signature does not match.')
			);
		}
	});

const handlePaymentFailure = (req, res) => {
	let callbackUrl;
	try {
		callbackUrl = req.query.callbackUrl;
	} catch (e) {
		callbackUrl = '';
	}
	res.render('payment_failure', { redirectUrl: callbackUrl });
};

const handlePaymentSuccess = (req, res, next) => {
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
		.populate('item')
		.populate('items.value')
		.populate('user')
		.exec(async (orderSearchError, order) => {
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
				const merchantSearchQuery = order.merchant
					? { _id: order.merchant }
					: { isDefault: true };
				const merchant = await Merchant.findOne(merchantSearchQuery);
				verifyRazorpayPayment({
					razorpayOrderId,
					razorpayPaymentId,
					razorpaySignature,
					razorpayApiKeySecret: merchant.apiKeySecret,
				})
					.then(() => {
						merchant
							.getRazorpayInstance()
							.payments.capture(razorpayPaymentId, order.amount)
							.then(() => {
								order.set('status', 'paid');
								order.set('razorpayPaymentId', razorpayPaymentId);
								order.save((saveError) => {
									if (saveError) {
										throw saveError;
									} else {
										if (order.item) {
											const servicePlanRequest = order.item;
											servicePlanRequest.markPaid(order._id);
											// eslint-disable-next-line no-param-reassign
											res.locals.redirectUrl = servicePlanRequest.callbackUrl;
										} else if (order.items) {
											order.items.forEach((item) => {
												item.value.markPaid(order._id);
												// eslint-disable-next-line no-param-reassign
												res.locals.redirectUrl = item.value.callbackUrl;
											});
										} else {
											// report this
										}
										// eslint-disable-next-line no-param-reassign
										setTimeout(() => {
											next();
										}, 5000);
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

const renderPaymentSuccessPage = (req, res) => {
	let callbackUrl;
	try {
		callbackUrl = req.query.callbackUrl || req.body.callbackUrl;
	} catch (e) {
		callbackUrl = '';
	}
	res.render('payment_success', {
		redirectUrl: `${getBaseApi(
			req
		)}/payments/service/request/after-success?redirectUrl=${callbackUrl}`,
	});
};

const handleRequestSuccessWithoutPaymentSuccess = (req, res) => {
	const order = res.locals.order;
	// eslint-disable-next-line no-param-reassign
	const item = res.locals.request;
	order.set('status', 'paid');
	order.save((saveError) => {
		if (saveError) {
			throw saveError;
		} else {
			item.markPaid(order._id);
			// eslint-disable-next-line no-param-reassign
			res.locals.redirectUrl = item.callbackUrl;
			setTimeout(() => {
				refreshToken(req, res, () => {
					renderPaymentSuccessPage(req, res);
				});
			}, 5000);
		}
	});
	// res.send({ message: 'Subscribed successfully without payment.' });
};
/**
 * Create Service Request for user
 */
const createServiceRequest = (req, res) => {
	const { servicePlan } = req.body;
	const { id: userId } = req.payload;
	const servicePlanRequest = new ServicePlanRequest({
		state: 'created',
		lifeCycle: [{ state: 'created' }],
		user: userId,
		servicePlan,
	});
	servicePlanRequest.save((saveError, savedServicePlanRequest) => {
		if (saveError) {
			res.status(422).send({
				message: 'Error occurred while saving',
				errorMessage: saveError.message,
			});
		} else {
			res.send({ success: true, servicePlanRequest: savedServicePlanRequest });
		}
	});
};

const getDiscountedAmount = (req, res) => {
	const { user } = res.locals;
	const {
		couponCode,
		servicePlan: servicePlanId,
		xpToUse,
		offer: offerId,
	} = req.query;
	const sendError = (e) => {
		res.status(422).send({
			message: 'Invalid coupon',
			couponCode,
			error: e ? e.message : '',
		});
		// throw new Error('Send Error');
	};
	const getDiscount = () => {
		const { offer } = res.locals;
		ServicePlan.findById(servicePlanId).exec((error, servicePlan) => {
			if (!servicePlan || error) {
				sendError(error);
			} else {
				const couponPromise = new Promise((resolve, reject) => {
					if (!couponCode) {
						reject(new Error('Empty coupon code'));
					} else {
						Coupon.findActiveCouponByCode(couponCode, (couponSearchError, coupon) => {
							if (couponSearchError || !coupon) {
								reject(new Error('Coupon does not exist'));
							} else {
								resolve(coupon);
							}
						});
					}
				});
				couponPromise
					.then((coupon) => {
						validateAndCalculateChargableAmountForServiceRequest({
							securedUser: secureUser(user),
							item: servicePlan,
							xpToUse,
							coupon,
							offer,
						})
							.then(({ amount, xpDiscount, couponDiscount }) => {
								res.send({
									amount,
									xpDiscount,
									couponDiscount,
									isValid: true,
								});
							})
							.catch((couponValidationError) => {
								sendError(
									couponValidationError
										? new Error(couponValidationError)
										: new Error('Coupon not valid for this product/service')
								);
							});
					})
					.catch(sendError);
			}
		});
	};

	const validateOffer = () =>
		new Promise((resolve, reject) => {
			if (!offerId) {
				resolve();
				return;
			}
			Offer.findById(offerId).exec((offerSearchError, offer) => {
				if (offerSearchError) {
					reject(new Error('Internal Server Error'));
				} else if (!offer) {
					reject('Invalid offer');
				} else {
					// eslint-disable-next-line no-param-reassign
					res.locals.offer = offer;
					resolve();
				}
			});
		});

	validateOffer().then(getDiscount).catch(sendError);
};

const startPaymentFlowForServicePlanRequest = (req, res) => {
	const {
		servicePlanRequest: servicePlanRequestId,
		couponCode,
		xp: xpToUse,
		callbackUrl,
	} = req.body;
	const { user } = res.locals;
	const securedUser = secureUser(user);
	const failureBaseUrl = `${getBaseApi(
		req
	)}/payments/service/request/pay/failure?type=service&userCourseId=${servicePlanRequestId}`;
	ServicePlanRequest.findById(servicePlanRequestId)
		.populate({
			path: 'servicePlan',
			select: 'services basePrice currency razorpayAccount disableTransfers',
			populate: { path: 'razorpayAccount' },
		})
		.exec((error, servicePlanRequest) => {
			if (error) {
				res.status(500).send({ message: 'Internal server error' });
				logger.error(`ServicePlan Checkout Error: ${error.message}`);
			} else if (!servicePlanRequest) {
				res.status(422).json({
					message: 'Invalid parameters',
					serviceRequestId: servicePlanRequestId,
					servicePlanRequest,
				});
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
						validateAndCalculateChargableAmountForServiceRequest({
							securedUser,
							item: servicePlanRequest.servicePlan,
							xpToUse,
							coupon,
						})
							.then(({ amount, xpDiscount, couponDiscount }) => {
								createOrder({
									amount,
									currency: 'INR',
									xpUsed: xpToUse,
									coupon,
									user,
									item: servicePlanRequest,
									xpDiscount,
									couponDiscount,
									itemModel: ServicePlanRequest.modelName,
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
												description: 'Request for service',
												notes,
												prefill,
												callback_url: `${getBaseApi(
													req
												)}/payments/service/request/pay/success?type=service&requestId=${
													servicePlanRequest._id
												}&orderId=${order._id}&callbackUrl=${callbackUrl}`,
												cancel_url: `${failureBaseUrl}&type=service&orderId=${order._id}&callbackUrl=${callbackUrl}`,
											};
											const response = createOrderRedirectHTML(options);
											res.send(response);
										} else {
											// eslint-disable-next-line no-param-reassign
											res.locals.order = order;
											// eslint-disable-next-line no-param-reassign
											res.locals.request = servicePlanRequest;
											handleRequestSuccessWithoutPaymentSuccess(req, res);
										}
									})
									.catch((createOrderError) => {
										// eslint-disable-next-line no-console
										res.status(500).send({
											message: 'Some error occurred',
											errorMessage: createOrderError.message,
											amount,
											xpDiscount,
											couponDiscount,
										});
										try {
											logger.error(
												`ServicePlan Checkout Error: While creating RazorpayOrder ${createOrderError.message} ${createOrderError.stack}`
											);
										} catch (e) {
											logger.error(
												`ServicePlan Checkout Error: Occurred while logging ${e.message}`
											);
										}
									});
							})
							.catch((couponValidationError) => {
								res.status(422).send({
									message: couponValidationError,
								});
							});
					})
					.catch((e) => {
						res.status(422).send({
							message: 'Invalid coupon',
							couponCode,
							error: e ? e.message : '',
						});
					});
			}
		});
};

const createOrdersWithOrWithoutCoupon = ({
	servicePlanRequests,
	user,
	securedUser,
	coupon,
	xpToUse,
	offersByServicePlanId,
	merchant,
}) =>
	Promise.all(
		servicePlanRequests.map(
			(servicePlanRequest) =>
				new Promise((resolve, reject) => {
					const offer = offersByServicePlanId[servicePlanRequest.servicePlan._id];
					let couponAppliedToSubOrder = coupon;
					validateAndCalculateChargableAmountForServiceRequest({
						securedUser,
						item: servicePlanRequest.servicePlan,
						xpToUse,
						coupon: couponAppliedToSubOrder,
						offer,
					})
						.catch(() => {
							couponAppliedToSubOrder = null;
							return validateAndCalculateChargableAmountForServiceRequest({
								securedUser,
								item: servicePlanRequest.servicePlan,
								xpToUse,
								coupon: couponAppliedToSubOrder,
								offer,
							});
						})
						.then((couponState) => {
							createOrder({
								amount: couponState.amount,
								currency: 'INR',
								xpUsed: xpToUse,
								coupon: couponAppliedToSubOrder,
								user,
								offer,
								offerDiscount: couponState.offerDiscount,
								item: servicePlanRequest,
								xpDiscount: couponState.xpDiscount,
								couponDiscount: couponState.couponDiscount,
								itemModel: ServicePlanRequest.modelName,
								createRazorpayOrder: false,
								merchant,
							})
								.then((order) => {
									resolve({ success: true, order });
								})
								.catch((createOrderError) => {
									// eslint-disable-next-line no-console
									resolve({
										success: false,
										error: createOrderError,
										order: { amount: couponState.amount, couponState },
									});
								});
						})
						.catch((error) => {
							reject(error);
						});
				})
		)
	).then((items) => {
		let error = null;
		let errorIn = null;
		const didFail = items.some((item) => {
			error = item.error;
			errorIn = item;
			if (error) {
				console.error(error);
			}
			return !item.success;
		});
		if (didFail) {
			// TODO: delete the successfull orders
			throw new Error(
				error
					? `${error.message}-${JSON.stringify(errorIn.order)}`
					: `Failed to create order ${JSON.stringify(errorIn.order)}`
			);
		} else {
			return items.map((item) => item.order);
		}
	});

const createOrderForServiceCart = async (req, res) => {
	const {
		servicePlans: servicePlanIds,
		offersByServicePlanId: offerIdsByServicePlanId = {},
		couponCode,
	} = req.body;
	const offersByServicePlanId = {};

	const servicePlans = await ServicePlan.find({ _id: { $in: servicePlanIds } });
	const merchants = servicePlans.map((servicePlan) => servicePlan.merchant);
	const merchantId = merchants[0];
	if (
		!every(merchants, (merchantItem) => {
			if (merchantId) {
				return merchantId === merchantItem;
			}
			return !merchantItem;
		})
	) {
		res.status(422).send({
			message: 'Items present from multiple merchants.',
			code: 'multi_merchant_checkout_not_supported',
		});
		return;
	}
	const merchantSearchQuery = merchantId
		? { _id: merchantId }
		: { isDefault: true };
	const merchant = await Merchant.findOne(merchantSearchQuery);

	const next = () => {
		const { id: userId } = req.payload;
		const xpToUse = 0;
		const { user } = res.locals;
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
				ServicePlanRequest.create(
					servicePlanIds.map((servicePlanId) => ({
						state: 'created',
						lifeCycle: [{ state: 'created' }],
						user: userId,
						servicePlan: servicePlanId,
					})),
					(error, _servicePlanRequests) => {
						if (error) {
							res
								.status(422)
								.send({ message: 'Failed to create service plan requests' });
						} else {
							ServicePlanRequest.find({
								_id: { $in: _servicePlanRequests.map((s) => s._id) },
								// these are searched again in databases to populate servicePlan
							})
								.populate('servicePlan')
								.exec((searchError, servicePlanRequests) => {
									if (searchError) {
										throw new Error('Unable to populate ServicePlan');
									} else {
										createOrdersWithOrWithoutCoupon({
											servicePlanRequests,
											user,
											securedUser: secureUser(user),
											coupon,
											xpToUse,
											offersByServicePlanId,
											merchant,
										})
											.then((orders) => {
												if (
													coupon &&
													!orders.some((order) => coupon.equals(order.coupon))
												) {
													res
														.status(422)
														.send({ message: 'Coupon not applicable for selected products' });
													return;
												}
												const orderGroup = new OrderGroup({
													items: orders.map((order) => order._id),
												});
												let xpUsed = 0;
												let xpDiscount = 0;
												let couponDiscount = 0;
												let amount = 0;
												orders.forEach((order) => {
													xpUsed += order.xpUsed;
													xpDiscount += order.xpDiscount;
													couponDiscount += order.couponDiscount;
													amount += order.amount;
												});
												orderGroup.save((_saveError) => {
													if (_saveError) {
														res.status(422).send({ message: 'Failed to create order group' });
													} else {
														createOrder({
															amount,
															currency: 'INR',
															xpUsed,
															coupon,
															user,
															item: orderGroup._id,
															xpDiscount,
															couponDiscount,
															itemModel: OrderGroup.modelName,
															merchant,
														})
															.then((order) => {
																orderGroup.parentOrder = order._id;
																orderGroup.save((saveError) => {
																	if (saveError) {
																		res.status(422).send({
																			message: 'Failed to create order group',
																		});
																	} else {
																		res.send({ order, success: 1 });
																	}
																});
															})
															.catch((orderCreationError) => {
																res.status(422).send({
																	message: 'Failed to create order for order group',
																	error: orderCreationError
																		? orderCreationError.message
																		: 'Unknown error',
																});
															});
													}
												});
											})
											.catch((errorCreatingOrders) => {
												res.status(422).send({
													message: 'Failed to create orders',
													error: errorCreatingOrders.message,
												});
											});
									}
								});
						}
					}
				);
			})
			.catch((couponError) => {
				res.status(422).send({ message: 'Coupon not found', error: couponError });
			});
	};

	Offer.find({ _id: map(offerIdsByServicePlanId) }).exec(
		(offerSearchError, offers) => {
			if (offerSearchError) {
				res.send({ message: 'Internal Server Error' });
			} else if (
				some(
					offerIdsByServicePlanId,
					(offerId) => !some(offers, (offer) => offer._id.equals(offerId))
				)
			) {
				res.send({ message: 'One of more offers are not valid anymore' });
			} else {
				map(servicePlanIds, (servicePlanId) => {
					const offerIdForServicePlan = offerIdsByServicePlanId[servicePlanId];
					some(offers, (offer) => {
						if (offer._id.equals(offerIdForServicePlan)) {
							offersByServicePlanId[servicePlanId] = offer;
							return true;
						}
						return false;
					});
				});
				Promise.all(
					map(offersByServicePlanId, (offer, servicePlanId) =>
						offer.isValid(servicePlanId)
					)
				)
					.then(() => {
						next();
					})
					.catch((error) => {
						res.status(422).send({ message: error.message });
					});
			}
		}
	);
};

const startPaymentForOrder = (req, res) => {
	const { order: orderId, callbackUrl, paymentGatewayOptions = {} } = req.body;
	const { id: userId } = req.payload;
	const { user } = res.locals;
	const failureBaseUrl = `${getBaseApi(
		req
	)}/payments/service/request/pay/failure?type=service&orderId=${orderId}`;
	Order.findOne({ _id: orderId, user: userId })
		.populate('item')
		.exec(async (searchError, order) => {
			if (searchError) {
				res
					.status(500)
					.send({ message: 'Internal server error', error: searchError.message });
			} else if (!order) {
				res.status(404).send({ message: 'Order not found' });
			} else if (order.amount) {
				const merchantSearchQuery = order.merchant
					? { _id: order.merchant }
					: { isDefault: true };
				const merchant = await Merchant.findOne(merchantSearchQuery);
				const key = merchant.apiKeyId;
				const notes = { user: user._id.toString() };
				const prefill = {
					contact: user.mobileNumber,
					email: user.email,
				};
				const options = {
					key_id: key,
					amount: order.amount,
					order_id: order.razorpayOrderId,
					name: paymentGatewayOptions.name || merchant.name || 'Prepseed',
					description: paymentGatewayOptions.description || '',
					notes,
					prefill,
					callback_url: `${getBaseApi(
						req
					)}/payments/service/request/pay/success?type=service&requestId=${
						order.item._id
					}&orderId=${order._id}&callbackUrl=${callbackUrl}&hostname=${
						req.hostname
					}`,
					cancel_url: `${failureBaseUrl}&type=service&orderId=${order._id}&callbackUrl=${callbackUrl}`,
				};
				if (paymentGatewayOptions.image) {
					options.image = paymentGatewayOptions.image;
				}
				const response = createOrderRedirectHTML(options);
				res.send(response);
			} else {
				// eslint-disable-next-line no-param-reassign
				res.locals.order = order;
				// eslint-disable-next-line no-param-reassign
				res.locals.request = order.item;
				// eslint-disable-next-line no-param-reassign
				res.locals.callbackUrl = callbackUrl;
				handleRequestSuccessWithoutPaymentSuccess(req, res);
			}
		});
};

module.exports = {
	createOrderForServiceCart,
	createServiceRequest,
	getDiscountedAmount,
	handlePaymentFailure,
	handlePaymentSuccess,
	renderPaymentSuccessPage,
	startPaymentFlowForServicePlanRequest,
	startPaymentForOrder,
};
