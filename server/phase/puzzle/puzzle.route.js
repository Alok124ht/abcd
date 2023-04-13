const express = require('express');
const puzzleCtrl = require('./puzzle.controller');
const router = express.Router(); // eslint-disable-line new-cap

router.route('/create').post(puzzleCtrl.create);

router.route('/getMany').post(puzzleCtrl.getMany);

router.route('/verify').post(puzzleCtrl.verify);

router.route('/publish').post(puzzleCtrl.publish);

router.route('/attempt').post(puzzleCtrl.attempt);

module.exports = router;
