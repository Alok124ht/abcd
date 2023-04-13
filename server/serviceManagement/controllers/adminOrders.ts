import { get } from 'lodash';
import { FilterQuery } from 'mongoose';
import { parseAsInteger, parseAsStringArray } from '../../utils/query';
import OrderModel from '../../models/Order';
import { Order } from '../../types/Order';
import { isAtLeast } from '../../utils/user/role';
import { UserRole } from '../../user/IUser';

export async function listOrders(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const { role } = req.payload;
	const limit = parseAsInteger(req.query.limit, 10);
	const skip = parseAsInteger(req.query.skip, 10);
	const merchantIds = get(res.locals, ['client', 'merchants']);
	const hasCoupon = parseAsInteger(req.query.hasCoupon, -1);
	const orderStatus = parseAsStringArray(req.query.orderStatus);

	const query: FilterQuery<Order> = {
		itemModel: 'OrderGroup',
	};
	if (orderStatus.length) {
		query.status = { $in: orderStatus };
	}

	if (!isAtLeast(UserRole.ADMIN, role)) {
		query.merchant = {
			$in: merchantIds || [],
		};
	}
	if (hasCoupon === 1 || hasCoupon === 0) {
		query.coupon = hasCoupon ? { $ne: null } : { $eq: null };
	}
	try {
		const total = await OrderModel.countDocuments(query);
		const orders = await OrderModel.find(query)
			.populate('coupon', 'code')
			.populate({
				path: 'user',
				select: 'name email subscriptions.subgroups.phases.phase',
				populate: { path: 'subscriptions.subgroups.phases.phase', select: 'name' },
			})
			.populate('item')
			.populate('merchant')
			.limit(limit)
			.skip(skip)
			.sort({ _id: -1 });
		res.send({
			total,
			items: orders,
			client: res.locals.client?.toObject(),
			query,
		});
	} catch (e) {
		next(e);
	}
}
