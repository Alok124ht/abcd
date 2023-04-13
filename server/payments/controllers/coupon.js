const Coupon = require('../../models/Coupon');
const { parseMongooseErrors } = require('../../mentors/utils');

const canSetField = (field, action) => {
	const settableFields = [
		'startTime',
		'endTime',
		'item',
		'items',
		'itemModel',
		'validations',
		'maxTimes',
		'timesUsed',
		'isAvailable',
		'discount',
	];
	if (field === 'item') {
		return false;
	}
	if (action === 'create') {
		return true;
	}
	return settableFields.indexOf(field) > -1;
};

const setCouponFields = ({
	coupon,
	fields,
	action,
	itemModel = 'MentorshipType',
}) => {
	Object.keys(fields).forEach((field) => {
		if (canSetField(field, action)) {
			let value = fields[field];
			if (field === 'items') {
				value = value.map((v) => ({
					value: v,
					itemModel,
				}));
			}
			coupon.set(field, value);
		}
	});
	return coupon;
};

const createOrUpdateCoupon = (req, res) => {
	const data = req.body.data;
	if (data._id) {
		Coupon.findById(data._id, (error, coupon) => {
			if (error || !coupon) {
				res.status(422).send({
					message: 'Some error occurred while searching for coupon',
				});
			} else {
				setCouponFields({
					coupon,
					fields: data,
					action: 'update',
					itemModel: data.itemModel,
				});
				coupon.save((errors) => {
					if (errors) {
						res.status(422).send({
							message: 'There are some errors in the request',
							errors: parseMongooseErrors(errors),
							coupon,
						});
					} else {
						res.send({ coupon });
					}
				});
			}
		});
	} else {
		const coupon = new Coupon();
		setCouponFields({
			coupon,
			fields: data,
			action: 'create',
			itemModel: data.itemModel,
		});
		coupon.save((errors) => {
			if (errors) {
				res.status(422).send({
					message: 'There are some errors in the request',
					errors: parseMongooseErrors(errors),
					coupon,
				});
			} else {
				res.send({ coupon });
			}
		});
	}
};

const getAllCouponsForAdmin = (req, res) => {
	const { isAvailable } = req.query;
	// eslint-disable-next-line eqeqeq
	Coupon.find({ isAvailable: isAvailable == '1' })
		.populate('item', 'label')
		.populate('items.value', 'label')
		.exec((searchError, coupons) => {
			if (searchError) {
				console.error(searchError);
				res.status(500).send({ message: 'Internal server error' });
			} else {
				res.send({ items: coupons });
			}
		});
};

/**
 * New Coupon API endpoints starts here
 */

const createCoupon = (req, res) => {
	const { id: userId } = req.payload;
	const {
		code,
		startTime,
		endTime,
		items,
		usageLimit,
		discount,
		validations,
	} = req.body;
	const coupon = new Coupon({
		code,
		startTime,
		endTime,
		items,
		usageLimit,
		discount,
		createdBy: userId,
		validations,
	});
	coupon.save((saveError) => {
		if (saveError) {
			res
				.status(422)
				.send({ message: 'Failed to create coupon', error: saveError });
		} else {
			res.send({ coupon });
		}
	});
};

const updateCoupon = (req, res) => {
	const { id: userId, role } = req.payload;
	const {
		_id,
		code,
		startTime,
		endTime,
		items,
		usageLimit,
		discount,
		validations,
	} = req.body;
	const query = { _id };
	if (role !== 'super') {
		query.createdBy = userId;
	}
	Coupon.findOne(query).exec((searchError, coupon) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!coupon) {
			res.status(404).send({ message: 'Coupon not found' });
		} else {
			coupon.set('code', code);
			coupon.set('startTime', startTime);
			coupon.set('endTime', endTime);
			coupon.set('items', items);
			coupon.set('usageLimit', usageLimit);
			coupon.set('discount', discount);
			coupon.set('validations', validations);
			coupon.save((saveError) => {
				if (saveError) {
					res
						.status(422)
						.send({ message: 'Failed to update coupon', error: saveError });
				} else {
					res.send({ coupon });
				}
			});
		}
	});
};

const getCoupons = (req, res) => {
	const { id: userId, role } = req.payload;
	const query = {};
	if (role !== 'super') {
		query.createdBy = userId;
	}
	Coupon.find(query)
		.populate('items.value')
		.find((searchError, coupons) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else {
				res.send({ coupons });
			}
		});
};

module.exports = {
	createCoupon,
	createOrUpdateCoupon,
	getAllCouponsForAdmin,
	getCoupons,
	updateCoupon,
};
