import { model, Schema } from 'mongoose';
import { Order, OrderModelInterface } from '../types/Order';

const { ObjectId } = Schema.Types;

const OrderSchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
		},
		amount: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			enum: ['INR'],
		},
		item: {
			type: ObjectId,
			refPath: 'itemModel',
			required: true,
		},
		itemModel: {
			type: String,
			required: true,
			enum: ['MentorshipRequest', 'ServicePlanRequest', 'OrderGroup'],
		},
		razorpayOrderId: {
			type: String,
		},
		razorpayPaymentId: {
			type: String,
		},
		razorpayRefundId: {
			type: String,
		},
		status: {
			type: String,
			enum: ['created', 'attempted', 'paid'],
			required: true,
			default: 'created',
		},
		xpUsed: {
			type: Number,
			default: 0,
			min: [0, 'XP used can only be non-negative'],
		},
		xpDiscount: {
			type: Number,
			default: 0,
			min: [0, 'xpDiscount used can only be non-negative'],
		},
		offer: {
			type: ObjectId,
			refPath: 'offerModel',
		},
		offerModel: {
			type: String,
			enum: ['Offer'],
			default: 'Offer',
		},
		coupon: {
			type: ObjectId,
			refPath: 'couponModel',
		},
		couponModel: {
			type: String,
			enum: ['Coupon'],
			default: 'Coupon',
		},
		couponDiscount: {
			type: Number,
			default: 0,
			min: [0, 'couponDiscount used can only be non-negative'],
		},
		offerDiscount: {
			type: Number,
			default: 0,
			min: [0, 'Offer discount can only be non-negative'],
		},
		merchant: {
			type: ObjectId,
			ref: 'Merchant',
		},
		data: {},
	},
	{ timestamps: true }
);

OrderSchema.method('getTransfers', function getTransfers(this: Order) {
	return new Promise((resolve, reject) => {
		const handlePopulatedItem = (order) => {
			try {
				if (order.item.getTransfers) {
					console.log('order.item.getTransfer exists', order.item);
					order.item
						.getTransfers(order.amount, order.currency)
						.then((transfers) => {
							resolve(transfers);
						})
						.catch((e) => {
							reject(e);
						});
				} else {
					// item does not support transfers
					resolve([]);
				}
			} catch (e) {
				// console.log('error occurred in order', order);
				console.error(e);
				resolve([]);
			}
		};
		if (this.populated('item')) {
			handlePopulatedItem(this);
		} else {
			// console.log('order before population', this);
			this.populate('item', (populationError, order) => {
				if (populationError) {
					reject(populationError);
				} else {
					handlePopulatedItem(order);
				}
			});
		}
	});
});

const OrderModel = model<Order, OrderModelInterface>('Order', OrderSchema);
export default OrderModel;
