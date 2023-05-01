import { isEmpty } from 'lodash';
import { FilterQuery, Types } from 'mongoose';
import { convertArrayToCSV } from 'convert-array-to-csv';
import Coupon from './models/Coupon';
import CourseModel from './models/Course';
import OrderModel from './models/Order';
import APIError from '../helpers/APIError';
import { sendPaymentSuccessEmail } from './utils';
import { validateEmail } from '../user/authLib';
import { Course } from './types/Course';

const validateCourse = ({
	type,
	courses,
	price,
	originalPrice,
}: {
	type: string;
	courses: Types.ObjectId[];
	price: string | number;
	originalPrice: string | number;
}) => {
	if (type !== 'combo' && !isEmpty(courses)) {
		return 'Courses are only allowed in combo';
	}
	if (originalPrice) {
		const parsedPrice = typeof price === 'string' ? parseFloat(price) : price;
		const parsedOriginalPrice =
			typeof originalPrice === 'string'
				? parseFloat(originalPrice)
				: originalPrice;
		if (!parsedPrice) {
			return '"price" must present when originalPrice is present';
		}
		if (Number.isNaN(parsedPrice)) {
			return '"price" must be a number, currently NaN';
		}
		if (parsedOriginalPrice) {
			return '"originalPrice" must be a number';
		}
		if (Number.isNaN(parsedOriginalPrice)) {
			return '"originalPrice" must be a number, currently NaN';
		}
		if (parsedOriginalPrice < parsedPrice) {
			return '"originalPrice" can not be less than price';
		}
	}
	return null;
};

export const createCourse = (
	req: ExpressRequest & {
		body: {
			config: {
				requireGrades: boolean;
			};
		};
	},
	res: ExpressResponse,
	next: ExpressNextFunction
) => {
	const { title, originalPrice, price, type, courses, config } = req.body;
	const validationError = validateCourse({
		originalPrice,
		price,
		type,
		courses,
	});
	if (validationError) {
		next(new APIError(validationError, 422, true));
		return;
	}
	const course = new CourseModel({
		title,
		originalPrice,
		price,
		type,
		courses,
		config,
	});
	course.save((error) => {
		if (error) {
			res.status(422).send({ message: 'Some error occurred', error });
		} else {
			res.send({ course });
		}
	});
};

export const updateCourse = (
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) => {
	const {
		_id: courseId,
		title,
		originalPrice,
		price,
		type,
		courses,
		config,
	} = req.body;
	const validationError = validateCourse({
		originalPrice,
		price,
		type,
		courses,
	});

	if (validationError) {
		next(new APIError(validationError, 422, true));
		return;
	}
	CourseModel.findById(courseId).exec((searchError, course) => {
		if (searchError) {
			next(new APIError(searchError.message, 500));
		} else if (!course) {
			next(new APIError('Course not found', 404));
		} else {
			if (title) {
				course.set('title', title);
			}

			if (originalPrice) {
				course.set('originalPrice', originalPrice);
			}
			if (price) {
				course.set('price', price);
			}
			if (type) {
				course.set('type', type);
			}
			if (courses) {
				course.set('courses', courses);
			}
			if (typeof config !== 'undefined') {
				course.set('config', config);
			}
			course.save((saveError) => {
				if (saveError) {
					next(new APIError(saveError.message, 422, true));
				} else {
					res.send({ course });
				}
			});
		}
	});
};

export const createCoupon = (req: ExpressRequest, res: ExpressResponse) => {
	const { code, courses, emailsRaw, maxUsageLimit, maxUsagePerEmail, discount } =
		req.body;

	const emails = emailsRaw ? JSON.parse(emailsRaw) : [];
	const coupon = new Coupon({
		code,
		courses,
		emails,
		maxUsageLimit,
		maxUsagePerEmail,
		discount,
	});
	coupon.save((saveError) => {
		if (saveError) {
			res
				.status(422)
				.send({ message: 'Unable to create coupon', error: saveError });
		} else {
			res.send({ coupon });
		}
	});
};

export const updateCoupon = (
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) => {
	const { _id, maxUsageLimit } = req.body;
	Coupon.findById(_id).exec((error, coupon) => {
		if (coupon) {
			coupon.set('maxUsageLimit', maxUsageLimit);
			coupon.save((saveError) => {
				if (saveError) {
					next(new APIError(saveError, 422));
				} else {
					res.send({ coupon });
				}
			});
		} else {
			next(new APIError('', 404));
		}
	});
};

export const getAllRegistrationsForCourse = (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { courseId, status, dataFormat = 'csv' } = req.query;
	const query: FilterQuery<Course> = {};
	if (courseId) {
		query.course = courseId;
	}
	if (status) {
		query.status = status;
	}
	OrderModel.find(query)
		.populate({ path: 'course', select: 'title' })
		.populate({ path: 'coupon', select: 'code' })
		.sort({ createdAt: -1 })
		.exec((searchError, orders) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else {
				const data = orders.map((order) => ({
					email: order.email,
					mobileNumber: order.mobileNumber,
					name: order.name,
					collegeName: order.collegeName,
					course: order.course ? order.course.title : '',
					amountPaid: order.amount / 100,
					status: order.status,
					couponCode: order.coupon ? order.coupon.code : '',
					courseId: order.course ? order.course._id : '',
					createdAt: order.createdAt,
					updatedAt: order.updatedAt,
					orderId: order._id,
				}));
				if (dataFormat === 'csv') {
					const options = {
						header: [
							'email',
							'mobileNumber',
							'name',
							'collegeName',
							'course',
							'amountPaid',
							'status',
							'couponCode',
							'courseId',
							'createdAt',
							'updatedAt',
							'orderId',
						],
						separator: ',',
					};
					const csv = convertArrayToCSV(data, options);
					res.attachment('registred_students.csv');
					res.type('text/csv');
					res.send(csv);
				} else {
					res.send({ items: data });
				}
			}
		});
};

export const getAllCoupons = (req: ExpressRequest, res: ExpressResponse) => {
	Coupon.find({}).exec((searchError, coupons) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else {
			const data = coupons.map((c) => [
				c._id,
				c.code,
				c.courses.join(' '),
				c.maxUsageLimit,
				c.maxUsagePerEmail,
				c.discount.unit,
				c.discount.value,
				c.discount.maximumAmount,
				c.emails.join(''),
			]);
			const options = {
				header: [
					'_id',
					'code',
					'courses',
					'maxUsageLimit',
					'maxUsagePerEmail',
					'discountUnit',
					'discountValue',
					'maxDiscountAmount',
					'emails',
				],
				separator: ',',
			};
			const csv = convertArrayToCSV(data, options);
			res.attachment('coupons.csv');
			res.type('text/csv');
			res.send(csv);
		}
	});
};

export const deleteCoupon = (req: ExpressRequest, res: ExpressResponse) => {
	const { _id } = req.query;
	Coupon.deleteOne({ _id }).exec((error) => {
		if (error) {
			res.status(422).send({ error });
		} else {
			res.send({ deleted: true });
		}
	});
};

export const getAllCourses = (
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) => {
	CourseModel.find()
		.populate('courses')
		.sort({ _id: -1 })
		.exec((error, courses) => {
			if (error) {
				next(new APIError('Internal Server Error', 500));
			} else {
				res.send({ courses });
			}
		});
};

/**
 * If a payment is captured manually, we can use this method to mark that order as paid
 */
export const markPaymentCapturedManually = (
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) => {
	const { orderId, razorpayPaymentId, email } = req.body;
	if (!orderId) {
		next(new APIError('Order Id must be present', 422, true));
	} else if (!razorpayPaymentId) {
		next(new APIError('razorpayPaymentId must be present', 422, true));
	}
	if (email && !validateEmail(email)) {
		next(new APIError('Invalid email', 422, true));
	} else {
		OrderModel.findById(orderId)
			.populate({
				path: 'course',
				populate: { path: 'courses', select: 'title' },
			})
			.exec((searchError, order) => {
				if (searchError) {
					next(new APIError('Error while searching', 422, true));
				} else if (!order) {
					next(new APIError('Order not found', 404, true));
				} else {
					order.set('status', 'paid');
					order.set('razorpayPaymentId', razorpayPaymentId);
					if (email) {
						order.set('email', email);
					}
					order.save((saveError) => {
						if (saveError) {
							next(saveError);
						} else {
							res.send({ order });
							sendPaymentSuccessEmail(order);
						}
					});
				}
			});
	}
};
