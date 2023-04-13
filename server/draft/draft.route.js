const express = require('express');
const draftCtrl = require('./draft.controller');
const { withClientOnlyIfModerator } = require('../client/middlewares');

const router = express.Router(); // eslint-disable-line new-cap

const auth = require('../middleware/auth').default;

router.route('/list').post(draftCtrl.list);
router.route('/save').post(auth.isModerator, draftCtrl.save);
router.route('/archive').post(auth.isModerator, draftCtrl.archive);
router.route('/unarchive').post(auth.isModerator, draftCtrl.unarchive);
router.route('/update').post(auth.isModerator, draftCtrl.update);
router.route('/publish').post(auth.isModerator, draftCtrl.publish);

router
	.route('/clone')
	.post(auth.isModerator, withClientOnlyIfModerator, draftCtrl.clone);

router.route('/:draftId').get(auth.isModerator, draftCtrl.getDraft);

module.exports = router;
