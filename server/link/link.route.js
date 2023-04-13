const express = require('express');
const linkCtrl = require('./link.controller');
const authMiddleware = require('../middleware/auth').default;

const router = express.Router(); // eslint-disable-line new-cap

router
	.route('/create')
	.post(authMiddleware.withClientOptional, linkCtrl.createLink);

router.route('/update').post(linkCtrl.updateLink);

router.route('/verify').post(linkCtrl.verify);

router.route('/publish').post(linkCtrl.publish);

router.route('/fixLinks').get(linkCtrl.fixLinks);

router.route('/fixLinkIds').get(linkCtrl.fixLinkIds);

router
	.route('/clear-cache/:id')
	.get(authMiddleware.createRoleValidator('admin'), linkCtrl.clearCache);

router
	.route('/update-client')
	.post(authMiddleware.createRoleValidator('admin'), linkCtrl.updateClient);

module.exports = router;
