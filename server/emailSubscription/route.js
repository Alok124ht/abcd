const express = require('express');
const auth = require('../middleware/auth').default;
const controller = require('./controller');

// eslint-disable-next-line new-cap
const router = express.Router();

router.route('/list').get(auth.required, auth.isSuper, controller.list);

router.route('/bounce').post(controller.addEmailToBounceList);
router
	.route('/bounced')
	.get(auth.required, auth.isSuper, controller.getBounceList);

module.exports = router;
