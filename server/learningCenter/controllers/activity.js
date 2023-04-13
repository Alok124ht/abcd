/* eslint-disable no-param-reassign */
const { reduce } = require('lodash');
const { convertArrayToCSV } = require('convert-array-to-csv');
const { filter, forEach, map, takeRight } = require('lodash');
const moment = require('moment');
const UserVideoActivity = require('../models/UserVideoActivity');
const UserVideoStat = require('../models/UserVideoStat').default;
const Playlist = require('../models/Playlist').default;
const PlaylistItem = require('../models/PlaylistItem').default;
const logger = require('../../../config/winston').default;
const APIError = require('../../helpers/APIError');

const addActivities = (req, res) => {
	const { userVideoStat } = res.locals;
	const activities = req.query.activities ||
		req.body.activities || [req.body.activity];
	const totalWatchTime = reduce(
		activities,
		(result, activity) => {
			let time = 0;
			if (activity.action === 'watch') {
				const duration = parseInt(activity.duration, 10);
				if (!Number.isNaN(duration)) {
					time += Math.min(duration, moment.duration(1, 'hours').asMilliseconds());
				}
			}
			return result + time;
		},
		0
	);
	forEach(activities, (activity) => {
		if (activity.action === 'joinLive') {
			userVideoStat.djl = true;
		}
	});
	userVideoStat.lastPosition = activities[0]?.lastPosition;
	userVideoStat.progress = activities[0]?.progress;
	userVideoStat.watchTime += totalWatchTime;
	userVideoStat.save((saveError) => {
		if (saveError) {
			res.status(422).send({ message: 'Some error occurred', error: saveError });
		} else {
			res.send({ userVideoStat });
		}
	});

	const { userVideoActivity } = res.locals;
	userVideoActivity.addActivities(activities);
	userVideoActivity.save((saveError) => {
		if (saveError) {
			logger.error(saveError.message);
			// res.send(userVideoActivity);
		} else {
			// res.send(422).send({ message: 'Unable to add' });
		}
	});
};

const withUserVideoActivity = (req, res, next) => {
	const videoId = req.query.videoId || req.body.videoId;
	const { id: userId } = req.payload;
	UserVideoActivity.findOne(
		UserVideoActivity.translateAliases({ video: videoId, user: userId })
	).exec((searchError, _doc) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!_doc) {
			const doc = new UserVideoActivity({ video: videoId, user: userId });
			res.locals.userVideoActivity = doc;
			next();
		} else {
			res.locals.userVideoActivity = _doc;
			next();
		}
	});
};

const withUserVideoActivityAdmin = (req, res, next) => {
	const videoId = req.query.videoId || req.body.videoId;
	const userId = req.query.userId || req.body.userId;
	UserVideoActivity.findOne(
		UserVideoActivity.translateAliases({ video: videoId, user: userId })
	).exec((searchError, _doc) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!_doc) {
			const doc = new UserVideoActivity({ video: videoId, user: userId });
			res.locals.userVideoActivity = doc;
			next();
		} else {
			res.locals.userVideoActivity = _doc;
			next();
		}
	});
};

const withUserVideoStat = (req, res, next) => {
	const videoId = req.query.videoId || req.body.videoId;
	const { id: userId } = req.payload;
	UserVideoStat.findOne(
		UserVideoStat.translateAliases({ video: videoId, user: userId })
	).exec((searchError, _doc) => {
		if (searchError) {
			res.status(500).send({ message: 'Unknown error', error: searchError });
		} else if (!_doc) {
			const doc = new UserVideoStat({ video: videoId, user: userId });
			res.locals.userVideoStat = doc;
			next();
		} else {
			res.locals.userVideoStat = _doc;
			next();
		}
	});
};

const withUserVideoStatAdmin = (req, res, next) => {
	const videoId = req.query.videoId || req.body.videoId;
	const userId = req.query.userId || req.body.userId;

	UserVideoStat.findOne(
		UserVideoStat.translateAliases({ video: videoId, user: userId })
	).exec((searchError, _doc) => {
		if (searchError) {
			res.status(500).send({ message: 'Unknown error', error: searchError });
		} else if (!_doc) {
			const doc = new UserVideoStat({ video: videoId, user: userId });
			res.locals.userVideoStat = doc;
			next();
		} else {
			res.locals.userVideoStat = _doc;
			next();
		}
	});
};

const generateDownloadableData = (items, options) => {
	const minimal = options && options.type === 'minimal';

	const columnConfig = {
		duration: {
			header: 'Duration(minutes)',
			converter: (item, activity) => Math.ceil(activity.duration / 1000 / 60),
		},
		playEndedAt: {
			header: 'Play Ended At',
			converter: (item, activity) => activity.createdAt,
		},
		email: {
			header: 'User Email',
			converter: (item) => item.user.email,
		},
		mobileNumber: {
			header: 'User Mobile Number',
			converter: (item) => item.user.mobileNumber,
		},
		userId: {
			header: 'User Id',
			converter: (item) => item.user._id,
		},
		videoTitle: {
			header: 'Video Title',
			converter: (item) => item.video.title,
		},
		videoTags: {
			header: 'Video Tags',
			converter: (item) =>
				map(item.video.tags, (tag) => `${tag.key}:${tag.value}`).join('|'),
		},
		videoId: {
			header: 'Video Id',
			converter: (item) => item.video._id,
		},
	};
	const columns = [];
	if (minimal) {
		columns.push('duration', 'playEndedAt', 'videoTitle');
	} else {
		forEach(columnConfig, (v, k) => columns.push(k));
	}
	const header = map(columns, (key) => columnConfig[key].header);
	const data = [];
	forEach(items, (item) => {
		forEach(item.activities, (activity) => {
			data.push(
				map(columns, (key) => columnConfig[key].converter(item, activity))
			);
		});
	});

	return convertArrayToCSV(data, {
		header,
	});
};

const getActivitiesByUser = (req, res) => {
	const { user: userId } = req.query;
	UserVideoActivity.find(UserVideoActivity.translateAliases({ user: userId }))
		.populate([
			{ path: 'u', select: 'email mobileNumber' },
			{ path: 'v', select: 'title' },
		])
		.exec((searchError, userVideoActivities) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else {
				res.type('text/csv');
				res.send(generateDownloadableData(userVideoActivities));
			}
		});
};

const getActivitiesByVideo = (req, res) => {
	const { video: videoId, format = 'csv' } = req.query;
	UserVideoActivity.find(UserVideoActivity.translateAliases({ video: videoId }))
		.populate([
			{ path: 'u', select: 'email mobileNumber' },
			{ path: 'v', select: 'title' },
		])
		.exec((searchError, userVideoActivities) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else if (format === 'csv') {
				res.type('text/csv');
				res.send(generateDownloadableData(userVideoActivities));
			} else {
				res.send(userVideoActivities);
			}
		});
};
async function getViewersOfVideo(req, res, next) {
	const { video: videoId } = req.query;
	if (!videoId) {
		next(new APIError('Video id must be present'));
		return;
	}
	try {
		const stats = await UserVideoStat.find({
			v: videoId,
			$or: [{ djl: true }, { iw: true }],
		}).populate('u', 'name username email mobileNumber dp');
		res.send({ items: stats });
	} catch (e) {
		next(e);
	}
}

const getActivitiesForPlaylists = (req, res, next) => {
	const { playlists: playlistIds, numberOfItems } = req.query;

	Playlist.find({ _id: { $in: playlistIds } }).exec(
		(playlistSearchError, playlists) => {
			if (playlistSearchError) {
				next(playlistSearchError, 500);
			} else {
				const playlistItemIds = [];
				forEach(playlists, (playlist) => {
					forEach(takeRight(playlist.items, numberOfItems), (item) =>
						playlistItemIds.push(item)
					);
				});
				PlaylistItem.find({ _id: { $in: playlistItemIds } })
					.select('resource resourceModel')
					.exec((playlistItemSearchError, playlistItems) => {
						if (playlistItemSearchError) {
							next(playlistItemSearchError, 500);
						} else {
							UserVideoActivity.find(
								UserVideoActivity.translateAliases({
									video: {
										$in: map(
											filter(playlistItems, (p) => p.resourceModel === 'Video'),
											(p) => p.resource
										),
									},
								})
							)
								.populate([
									{ path: 'u', select: 'email mobileNumber' },
									{ path: 'v', select: 'title' },
								])
								.exec((searchError, userVideoActivities) => {
									if (searchError) {
										res.status(500).send({ message: 'Internal Server Error' });
									} else {
										res.type('text/csv');
										res.send(generateDownloadableData(userVideoActivities));
									}
								});
						}
					});
			}
		}
	);
};

async function getMyCompletedVideos(req, res, next) {
	const { id: userId } = req.payload;
	try {
		const items = await UserVideoStat.find({
			u: userId,
			$or: [{ iw: true }, { djl: true }],
		}).select('v djl iw');
		res.send(items);
	} catch (e) {
		next(e);
	}
}

/**
 * Get number of videos watched
 */
const getMyProgress = (req, res) => {
	const { id: userId } = req.payload;
	UserVideoStat.countDocuments(
		UserVideoStat.translateAliases({
			user: userId,
			$or: [{ isWatched: true }, { didJoinLive: true }],
		})
	).exec((error, count) => {
		if (error) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else {
			res.send({ count });
		}
	});
};

/**
 * Get my video activity
 */
const getMyStats = (req, res) => {
	const { id: userId } = req.payload;
	const { includeTags: includeTagsRaw, format = 'csv' } = req.query;
	const includeTags = includeTagsRaw === '1';
	const videoSelectKeys = includeTags ? 'title tags' : 'title';
	UserVideoActivity.find(UserVideoActivity.translateAliases({ user: userId }))
		.populate([
			{ path: 'u', select: 'email mobileNumber' },
			{ path: 'v', select: videoSelectKeys },
		])
		.exec((searchError, userVideoActivities) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else if (format === 'json') {
				res.send(userVideoActivities);
			} else {
				res.type('text/csv');
				res.attachment('my_video_activity.csv');
				res.send(
					generateDownloadableData(userVideoActivities, {
						type: includeTags ? 'full' : 'minimal',
					})
				);
			}
		});
};

module.exports = {
	addActivities,
	getMyProgress,
	withUserVideoActivity,
	withUserVideoActivityAdmin,
	withUserVideoStat,
	withUserVideoStatAdmin,
	getActivitiesByUser,
	getActivitiesByVideo,
	getActivitiesForPlaylists,
	getMyStats,
	getMyCompletedVideos,
	getViewersOfVideo,
};
