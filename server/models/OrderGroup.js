const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

const OrderGroupSchema = new Schema(
	{
		items: [
			{
				type: ObjectId,
				ref: 'Order',
			},
		],
		parentOrder: {
			type: ObjectId,
			ref: 'Order',
		},
		user: {
			type: ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

OrderGroupSchema.method('markPaid', function markPaid() {
	this.populate('parentOrder').populate(
		{ path: 'items', populate: { path: 'item' } },
		async (populateError, orderGroup) => {
			if (populateError) {
				console.error(populateError);
				return;
			}
			console.log('marking order group paid');
			const { parentOrder } = orderGroup;
			for (let index = 0; index < orderGroup.items.length; index += 1) {
				const item = orderGroup.items[index];
				item.set('razorpayOrderId', parentOrder.razorpayOrderId);
				item.set('razorpayPaymentId', parentOrder.razorpayPaymentId);
				item.set('status', parentOrder.status);
				try {
					// eslint-disable-next-line no-await-in-loop
					await item.save();
					// eslint-disable-next-line no-await-in-loop
					await item.item.markPaid();
				} catch (saveError) {
					// TODO: log this error
					console.log('error occurred while marking order group paid');
					console.error(saveError);
				}
			}
			return;
			Promise.all(
				orderGroup.items.map(
					(item) =>
						new Promise((resolve) => {
							item.set('razorpayOrderId', parentOrder.razorpayOrderId);
							item.set('razorpayPaymentId', parentOrder.razorpayPaymentId);
							item.set('status', parentOrder.status);
							item.save((saveError) => {
								if (saveError) {
									resolve({ success: false, item, error: saveError });
								} else {
									resolve({ success: true, item });
								}
							});
						})
				)
			).then((promiseStatus) => {
				const didFail = promiseStatus.some(({ success, error: _error }) => {
					if (!success) {
						console.error(_error);
					}
					return !success;
				});
				if (didFail) {
					// should not have happened
				} else {
					promiseStatus.forEach(({ item: orderItem }) => {
						orderItem.item.markPaid(orderItem);
					});
				}
			});
		}
	);
});

OrderGroupSchema.method('getTransfers', function getTransfers() {
	return new Promise((resolve, reject) => {
		console.log('orderGroup getTransfers called');
		// resolve([]);
		// return;
		const handlePopulatedItem = (orderGroup) => {
			console.error('OrderGroup handing populated');
			Promise.all(
				orderGroup.items.map(
					(order) =>
						new Promise((_resolve, _reject) => {
							if (order.getTransfers) {
								order
									.getTransfers()
									.then((transfers) => {
										_resolve(transfers);
									})
									.catch((e) => {
										console.error('OrderGroup transfers error', e);
										_reject(e);
									});
								// resolve(order.item.getTransfers());
							} else {
								// item does not support transfers
								resolve([]);
							}
						})
				)
			)
				.then((listOfTransfers) => {
					console.log('listOfTransfers', listOfTransfers);
					let transfers = [];
					listOfTransfers.forEach((transfer) => {
						transfers = [...transfers, ...transfer];
					});
					resolve(transfers);
				})
				.catch((e) => {
					reject(e);
				});
		};
		if (this.populated('items')) {
			handlePopulatedItem(this);
		} else {
			this.populate(
				{ path: 'items', populate: { path: 'item' } },
				(error, orderGroup) => {
					if (error) {
						console.log('orderGroup population error');
						console.error(error);
						reject(error);
					} else {
						console.log('orderGroup populated successfully');
						handlePopulatedItem(orderGroup);
						// resolve(orderGroup);
					}
				}
			);
		}
	});
});

module.exports = mongoose.model('OrderGroup', OrderGroupSchema);
