const express = require('express');

const { getUnread, getLatest, updateLastSeen } = require('./controller');

// eslint-disable-next-line
const router = express.Router();

router.route('/latest').get(getLatest);
router.route('/unread').get(getUnread);
router.route('/seen').patch(updateLastSeen);

module.exports = router;
