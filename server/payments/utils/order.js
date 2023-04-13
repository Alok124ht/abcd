const Razorpay = require('razorpay');

const razorpayInstance = new Razorpay({
	key_id: process.env.RAZOR_PAY_KEY_ID,
	key_secret: process.env.RAZOR_PAY_KEY_SECRET,
});

const refundOrder = ({ order, amount, notes, user }) => {
	const { razorpayPaymentId } = order;
	const promise = new Promise((resolve, reject) => {
		if (razorpayPaymentId) {
			razorpayInstance.payments
				.refund(razorpayPaymentId, { amount, notes })
				.then(({ id: refundId }) => {
					order.set('razorpayRefundId', refundId);
					order.save((error) => {
						if (error) {
							reject(new Error(`Unable to save razorpayRefundId ${refundId}`));
						} else if (order.xpUsed) {
							user.xp.used.push({
								xp: order.xpUsed * -1,
								code: `order-${order._id}-refund`,
							});
							user.save(() => {
								if (error) {
									reject(new Error('Failed to refund XP.'));
								} else {
									resolve();
								}
							});
						} else {
							resolve();
						}
					});
				})
				.catch(() => {
					reject(new Error('Internal Server Error'));
				});
		} else if (order.xpUsed) {
			user.xp.used.push({
				xp: order.xpUsed * -1,
				code: `order-${order._id}-refund`,
			});
			user.save((error) => {
				if (error) {
					reject(new Error('Failed to refund XP.'));
				} else {
					resolve();
				}
			});
		} else {
			resolve();
		}
	});

	return promise;
};

module.exports = { refundOrder };
