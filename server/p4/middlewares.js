const { isEmpty } = require('lodash');
const Coupon = require('./models/Coupon').default;
const Course = require('./models/Course').default;

const withCoupon = (req, res, next) => {
	const couponCode = req.body.couponCode || req.query.couponCode;
	if (isEmpty(couponCode) || isEmpty(couponCode.trim())) {
		next();
	} else {
		Coupon.findOne({ code: { $regex: new RegExp(`^${couponCode}$`, 'i') } }).exec(
			(searchError, coupon) => {
				if (searchError) {
					res.status(500).send({ message: 'Internal Server Error' });
				} else if (!coupon) {
					res.status(422).send({ message: 'Invalid coupon code' });
				} else {
					// eslint-disable-next-line no-param-reassign
					res.locals.coupon = coupon;
					next();
				}
			}
		);
	}
};

const withCourse = (req, res, next) => {
	const courseId =
		req.body.courseId || req.query.courseId || req.params.courseId;
	Course.findById(courseId)
		.populate({ path: 'courses', select: 'title originalPrice price' })
		.exec((searchError, course) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else if (!course) {
				res.status(422).send({ message: 'Invalid course' });
			} else {
				// eslint-disable-next-line no-param-reassign
				res.locals.course = course;
				next();
			}
		});
};

module.exports = { withCoupon, withCourse };
