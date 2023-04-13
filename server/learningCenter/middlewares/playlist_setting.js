const PlaylistSetting = require('../models/PlaylistSetting');

const createPlaylistSetting = (req, res, next) => {
	const playlistSetting = new PlaylistSetting();
	// eslint-disable-next-line no-param-reassign
	res.locals.playlistSetting = playlistSetting;
	next();
};

const createFindPlaylistSetting = (withoutUserValidation) => (
	req,
	res,
	next
) => {
	const playlistSettingId =
		req.query.playlistSettingId ||
		req.body.playlistSettingId ||
		req.params.playlistSettingId;
	const { id: userId } = req.payload;
	const query = { _id: playlistSettingId };
	if (!withoutUserValidation) {
		query.createdBy = userId;
	}
	PlaylistSetting.findOne(query).exec((error, playlistSetting) => {
		if (error || !playlistSetting) {
			res.status(404).send({ message: 'Playlist not found' });
		} else {
			// eslint-disable-next-line no-param-reassign
			res.locals.playlistSetting = playlistSetting;
			next();
		}
	});
};

module.exports = { createPlaylistSetting, createFindPlaylistSetting };
