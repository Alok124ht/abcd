// eslint-disable-next-line new-cap
const router = require('express').Router();
const controller = require('../controllers/userServicePlan');

// service data
router.route('/s/d').get(controller.getUserServicePlansForService);

module.exports = router;
