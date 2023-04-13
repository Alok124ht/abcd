const { isEmpty, includes, some } = require('lodash');
const EmailTemplates = require('email-templates');
const Order = require('./models/Order');
const crypto = require('crypto');
const { sendEmail } = require('../utils/mail');

const verifyRazorpayPayment = ({
	razorpayOrderId,
	razorpayPaymentId,
	razorpaySignature,
}) =>
	new Promise((resolve, reject) => {
		const message = `${razorpayOrderId}|${razorpayPaymentId}`;
		const generatedSignature = crypto
			.createHmac('sha256', process.env.RAZOR_PAY_KEY_SECRET)
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

const validateEmail = (coupon, email) =>
	new Promise((resolve, reject) => {
		if (isEmpty(coupon.emails) || includes(coupon.emails, email)) {
			resolve();
		} else {
			reject('Invalid coupon');
		}
	});

const validateTotalUsageLimit = (coupon) =>
	new Promise((resolve, reject) => {
		if (coupon.maxUsageLimit === -1) {
			resolve();
		} else {
			Order.countDocuments(
				{ coupon: coupon._id, status: 'paid' },
				(error, usageCount) => {
					if (error) {
						reject('Error counting coupon usage. Internal Server Error.');
					} else if (usageCount < coupon.maxUsageLimit) {
						resolve();
					} else {
						// eslint-disable-next-line quotes
						reject("Sorry, you are late. The coupon has reached it's usage limit.");
					}
				}
			);
		}
	});

const validateUserUsageLimit = (coupon, email) =>
	new Promise((resolve, reject) => {
		if (coupon.maxUsagePerEmail === -1) {
			resolve();
		} else {
			Order.countDocuments(
				{ coupon: coupon._id, status: 'paid', email },
				(error, usageCount) => {
					if (error) {
						reject('Error validating user usage limit. Internal Server Error');
					} else if (usageCount < coupon.maxUsagePerEmail) {
						resolve();
					} else {
						// eslint-disable-next-line quotes
						reject(
							`This coupon can be only be used ${coupon.maxUsagePerEmail} time${
								coupon.maxUsagePerEmail > 1 ? 's' : ''
							}`
						);
					}
				}
			);
		}
	});

const validateAndCalculateCouponDiscount = (
	coupon,
	email,
	mobileNumber,
	course
) =>
	new Promise((resolve, reject) => {
		if (!coupon) {
			resolve(0);
		} else {
			if (!some(coupon.courses, (c) => c.equals(course._id))) {
				reject('This coupon is not applicable for this course');
				return;
			}
			validateEmail(coupon, email)
				.then(() => {
					validateTotalUsageLimit(coupon)
						.then(() => {
							validateUserUsageLimit(coupon)
								.then(() => {
									const discount = Math.floor(coupon.calculateDiscount(course.price));
									resolve(discount);
								})
								.catch(reject);
						})
						.catch((error) => {
							reject(error);
						});
				})
				.catch(reject);
		}
	});

const sendPaymentSuccessEmail = (order) => {
	const emailTemplateClient = new EmailTemplates();
	emailTemplateClient
		.render('p4/order_success', {
			name: order.name,
			courseName: order.course.title,
			amount: order.amount / 100,
			type: order.course.type,
			courses: order.course.courses,
		})
		.then((html) => {
			sendEmail(
				{
					subject:
						order.course.type === 'combo'
							? `Purchase of ${order.course.title} combo pack | Prepseed P4`
							: `Registration for ${order.course.title} | Prepseed P4`,
					to: [order.email],
					body: html,
					bodyType: 'html',
				},
				console.log
			);
		})
		.catch((e) => {
			console.error(new Error('Unable to create template for sending email'));
			console.error(e);
		});
};

module.exports = {
	validateAndCalculateCouponDiscount,
	verifyRazorpayPayment,
	sendPaymentSuccessEmail,
};
