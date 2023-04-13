import { Document, Model, Types } from 'mongoose';

interface Order extends Document {
	/** orderd by */
	user: Types.ObjectId;
	/** amount paid */
	amount: number;
	currency: 'INR';
	item: Types.ObjectId;
	itemModel: 'OrderGroup' | 'ServicePlanRequest';
	razorpayOrderId: string;
	razorpayPaymentId: string;
	razorpayRefundId: string;
	status: 'created' | 'attempted' | 'paid';
	xpUsed: number;
	xpDiscount: number;

	offer: Types.ObjectId;
	offerModel: 'Offer';
	/** offer discount amount applied */
	offerDiscount: number;

	coupon: Types.ObjectId;
	couponModel: 'Coupon';
	/** coupon discount amount applied */
	couponDiscount: number;

	merchant: Types.ObjectId;

	data: any;
	createdAt: Date;
	updatedAt: Date;

	/** get transfers for order */
	getTransfers: () => Promise<[any]>;
}
interface OrderModelInterface extends Model<Order> {}
