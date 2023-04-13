const PlaylistSetting = require('../models/PlaylistSetting');

const updatePlaylistSetting = (req, res) => {
	const { playlistSetting } = res.locals;
	const {
		sortBy,
		isPublic,
		label,
		groupBy,
		theme,
		thumbnailViewTheme,
		thumbnailBackgroundColor,
	} = req.body;
	const { id: userId } = req.payload;
	playlistSetting.set({
		sortBy,
		createdBy: userId,
		isPublic: isPublic === '1',
		label,
		groupBy,
		theme,
		thumbnailViewTheme,
		thumbnailBackgroundColor,
	});
	playlistSetting.save((error) => {
		if (error) {
			res.status(422).send({
				message: 'Error occurred while saving playlist',
				error: error.message,
			});
		} else {
			res.send({ playlistSetting });
		}
	});
};

const getList = (req, res) => {
	const { id: userId } = req.payload;
	const { includePublic } = req.query;
	const or = [{ createdBy: userId }];
	if (includePublic === '1') {
		or.push({ isPublic: true });
	}
	PlaylistSetting.find({ $or: or })
		.populate({ path: 'createdBy', select: 'name' })
		.exec((error, items) => {
			if (error) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else {
				res.send({ items });
			}
		});
};

const getSelectOptions = (req, res) => {
	const themeSchema = PlaylistSetting.schema.path('theme');
	const thumbnailViewThemeSchema = PlaylistSetting.schema.path(
		'thumbnailViewTheme'
	);
	const groupBySchema = PlaylistSetting.schema.path('groupBy');
	res.send({
		theme: {
			defaultValue: themeSchema.defaultValue,
			items: themeSchema.enumValues,
		},
		thumbnailViewTheme: {
			items: thumbnailViewThemeSchema.enumValues,
			defaultValue: thumbnailViewThemeSchema.defaultValue,
		},
		groupBy: {
			items: groupBySchema.enumValues,
			defaultValue: groupBySchema.defaultValue,
		},
	});
};

const get = (req, res) => {
	const { playlistSetting } = res.locals;
	res.send({ playlistSetting });
};

module.exports = { updatePlaylistSetting, getList, get, getSelectOptions };
