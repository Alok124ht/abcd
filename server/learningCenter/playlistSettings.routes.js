const express = require('express');
const auth = require('../middleware/auth').default;
const middleware = require('./middlewares/playlist_setting');
const controller = require('./controllers/playlist_setting');

const router = express.Router(); // eslint-disable-line new-cap

router
	.route('/create')
	.post(
		auth.required,
		middleware.createPlaylistSetting,
		controller.updatePlaylistSetting
	);

router
	.route('/update/:playlistSettingId')
	.patch(
		auth.required,
		middleware.createFindPlaylistSetting(),
		controller.updatePlaylistSetting
	);

router.route('/').get(auth.required, controller.getList);

router.route('/selectOptions').get(auth.required, controller.getSelectOptions);

router
	.route('/:playlistSettingId')
	.get(
		auth.required,
		middleware.createFindPlaylistSetting(true),
		controller.get
	);

module.exports = router;
