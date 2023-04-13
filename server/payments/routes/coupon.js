const express = require('express');
const {
	createCoupon,
	updateCoupon,
	getCoupons,
} = require('../controllers/coupon');
const auth = require('../../middleware/auth').default;

// eslint-disable-next-line new-cap
const router = express.Router();

const isModerator = auth.createRoleValidator('moderator');

router.use(auth.required, isModerator);

router.route('/').get(getCoupons).post(createCoupon).patch(updateCoupon);

module.exports = router;
