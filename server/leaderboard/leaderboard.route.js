const express = require('express');
const leaderboardCtrl = require('./leaderboard.controller');
const middlewares = require('./middlewares');
const auth = require('../middleware/auth').default;

const router = express.Router(); // eslint-disable-line new-cap

router
	.route('/get')
	.get(auth.required, middlewares.isPhaseValidObjectId2, leaderboardCtrl.get);

router
	.route('/getphaseleaderboard/:phase')
	.get(middlewares.isPhaseValidObjectId, leaderboardCtrl.getphaseleaderboard);

router
	.route('/getranks')
	.get(
		auth.required,
		middlewares.isPhaseValidObjectId2,
		leaderboardCtrl.getranks
	);

router
	.route('/getleaderboard/:phase')
	.get(auth.required, leaderboardCtrl.getleaderboard);
router.route('/getupdatelog').post(auth.required, leaderboardCtrl.getupdatelog);

router
	.route('/update-leaderboard')
	.get(auth.required, leaderboardCtrl.updateLeaderboard);

module.exports = router;
