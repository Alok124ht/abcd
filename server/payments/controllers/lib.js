import { size } from 'lodash';
import Order from '../../models/Order';

const PAYMENT_HANDLER_URL = 'https://api.razorpay.com/v1/checkout/embedded';

const flatten = (data, prefix) => {
	const flattened = {};
	Object.keys(data).forEach((key) => {
		const value = data[key];
		if (typeof value === 'object') {
			const values = flatten(
				value,
				`${prefix}${prefix ? '[' : ''}${key}${prefix ? ']' : ''}`
			);
			Object.keys(values).forEach((k) => {
				flattened[k] = values[k];
			});
		} else {
			flattened[`${prefix}${prefix ? '[' : ''}${key}${prefix ? ']' : ''}`] = value;
		}
	});
	return flattened;
};
const createOrderRedirectHTML = (options) => {
	const flattenedOptions = flatten(options, '');
	const inputFieldsHtml = Object.keys(flattenedOptions)
		.map(
			(name) =>
				`<input type="hidden" name="${name}" value="${flattenedOptions[name]}"/>`
		)
		.join('');
	return `<html>
        <head>
            <script>window.onload = function(){document.getElementById('form').submit()}</script>
        </head>
        <body>
            <form id='form' action="${PAYMENT_HANDLER_URL}" method="post">
                ${inputFieldsHtml}
            </form>
        </body>
`;
};

const minimumXPRequired = process.env.MINIMUM_XP_BALANCE;
const xpPerRupee = parseInt(process.env.XP_PER_RUPEE, 10);

const convertXPToPaise = (xp) => {
	if (typeof xpPerRupee === 'undefined') {
		return 0;
	}
	if (typeof xp === 'number') {
		return (xp / xpPerRupee) * 100;
	}
	return 0;
};

const calculateDiscountOnAmount = (amount, discount) => {
	const { maximumAmount, unit, value } = discount;
	let valueBasedDiscount = 0;
	if (unit === 'percentage') {
		const percentageInNumbers = value / 100;
		valueBasedDiscount = amount * percentageInNumbers;
	} else {
		valueBasedDiscount = Math.min(value, amount);
	}

	if (!maximumAmount || maximumAmount === -1) {
		return Math.floor(valueBasedDiscount);
	}
	return Math.floor(Math.min(maximumAmount, valueBasedDiscount));
};

const calculateDiscountForCoupon = ({
	coupon,
	user,
	item,
	xpToUse,
	offerDiscount = 0,
}) => {
	if (!coupon) {
		return { isValid: true, discount: 0 };
	}
	let isValid =
		size(coupon.validations) === 0 ||
		coupon.validations.some((validation) => {
			const { type, value } = validation;
			if (type === 'email') {
				if (!user) {
					return false;
				}
				if (
					typeof value === 'string' &&
					value[0] === '^' &&
					value[value.length - 1] === '$'
				) {
					const regex = new RegExp(value.regex ? value.regex : value);
					return regex.test(user.email);
				}

				return user.email === value;
			}
			return false;
		});

	let itemId;

	try {
		itemId = item.id.toString();
	} catch (e) {
		itemId = item.toString();
	} finally {
		if (!itemId) {
			itemId = null;
		}
	}

	if (!coupon.items.some((i) => i.value.toString() === itemId)) {
		isValid = false;
	}

	if (!isValid) {
		return { isValid: false };
	}

	let couponDiscount = 0;
	if (coupon.xpEligibleForDiscount) {
		couponDiscount =
			calculateDiscountOnAmount(item.basePrice, coupon.discount) -
			convertXPToPaise(xpToUse);
	} else {
		couponDiscount = calculateDiscountOnAmount(
			item.basePrice - convertXPToPaise(xpToUse) - offerDiscount,
			coupon.discount
		);
	}
	return { isValid: true, discount: couponDiscount };
};

const validateAndCalculateChargeableAmount = ({
	securedUser,
	request,
	xpToUse,
	coupon,
}) => {
	const maximumPossibleXPUsable = Math.max(
		securedUser.xp.net - minimumXPRequired,
		0
	);
	if (xpToUse > maximumPossibleXPUsable || xpToUse < -1) {
		return { error: 'Not enough XP.', isValid: false };
	}
	const xpDiscount = convertXPToPaise(xpToUse);
	const { isValid: isCouponValid, discount: couponDiscount } =
		calculateDiscountForCoupon({
			coupon,
			user: securedUser,
			item: request.type,
			xpToUse,
		});
	if (!isCouponValid) {
		return { isValid: false, error: 'Coupon not valid for you.' };
	}
	return {
		isValid: true,
		amount: request.type.basePrice - xpDiscount - couponDiscount,
		couponDiscount,
		xpDiscount,
	};
};

// This function does not validate the offer.
const calculateOfferDiscount = (item, offer) => {
	const discount = offer ? offer.discount.calculate(item.basePrice) : 0;
	return discount;
};

const validateAndCalculateChargableAmountForServiceRequest = ({
	securedUser,
	item,
	xpToUse,
	coupon,
	offer,
}) => {
	const maximumPossibleXPUsable = Math.max(
		securedUser ? securedUser.xp.net - minimumXPRequired : 0,
		0
	);
	return new Promise((resolve, reject) => {
		if (xpToUse > maximumPossibleXPUsable || xpToUse < -1) {
			reject(new Error('Not enough XP.'));
		} else {
			const offerPromise = offer ? offer.isValid(item) : new Promise((_r) => _r());
			offerPromise
				.then(() => {
					const offerDiscount = calculateOfferDiscount(item, offer);
					const xpDiscount = convertXPToPaise(xpToUse);

					const { isValid: isCouponValid, discount: couponDiscount } =
						calculateDiscountForCoupon({
							coupon,
							user: securedUser,
							item,
							xpToUse,
							offerDiscount,
						});
					if (!isCouponValid) {
						reject(new Error('Coupon not valid for you.'));
						return;
					}

					resolve({
						isValid: true,
						amount: item.basePrice - xpDiscount - couponDiscount - offerDiscount,
						couponDiscount,
						xpDiscount,
						offerDiscount,
					});
				})
				.catch((error) => {
					reject(error || new Error('Unknown error while validating offer'));
				});
		}
	});
};

const createOrder = ({
	amount,
	user,
	xpUsed,
	xpDiscount,
	coupon,
	couponDiscount,
	currency,
	item,
	itemModel,
	data,
	createRazorpayOrder = true,
	offer,
	offerDiscount,
	merchant,
}) => {
	const promise = new Promise((resolve, reject) => {
		const order = new Order({
			amount,
			user: user._id,
			currency,
			item,
			itemModel,
			data,
			coupon,
			couponDiscount,
			xpUsed,
			xpDiscount,
			offer,
			offerDiscount,
			merchant: merchant._id,
		});
		order.save((error, savedOrder) => {
			if (error) {
				reject(error);
			} else if (!amount) {
				resolve(savedOrder);
			} else if (!createRazorpayOrder) {
				resolve(savedOrder);
			} else {
				order
					.getTransfers()
					.then((transfers) => {
						merchant
							.getRazorpayInstance()
							.orders.create({
								amount: savedOrder.amount,
								currency: savedOrder.currency,
								receipt: savedOrder._id.toString(),
								transfers,
							})
							.then((razorpayOrder) => {
								savedOrder.set('razorpayOrderId', razorpayOrder.id);
								savedOrder.save((orderSaveError) => {
									if (orderSaveError) {
										reject(orderSaveError);
									} else {
										resolve(savedOrder);
									}
								});
							})
							.catch((razorpayError) => {
								reject(razorpayError);
							});
					})
					.catch(() => {
						reject(new Error('Failed to process'));
					});
			}
		});
	});
	return promise;
};

export default {
	calculateDiscountForCoupon,
	convertXPToPaise,
	createOrder,
	createOrderRedirectHTML,
	validateAndCalculateChargeableAmount,
	validateAndCalculateChargableAmountForServiceRequest,
};
