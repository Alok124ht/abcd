// eslint-disable-next-line new-cap
const router = require('express').Router();
const auth = require('../middleware/auth').default;

const controller = require('./controller');

router
	.route('/last-deployed-frontend')
	.get(
		auth.required,
		auth.createRoleValidator('admin'),
		controller.getFrontDeployTimestampsBySubdomains
	);

module.exports = router;
