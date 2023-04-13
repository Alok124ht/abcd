const { reduce, size } = require('lodash');
const APIError = require('../../helpers/APIError');
const Playlist = require('../models/Playlist').default;
const {
	userHasAccessToServiceInPhase,
} = require('../../utils/user/servicePlans');

const playlistPopulatePublic = [
	{
		path: 'items',
		populate: {
			path: 'resource',
			select:
				'title description thumbNailsUrls type liveFrom liveTill liveUrl isEmbeded embedType tags',
		},
		// select: 'availableFrom availableTill tags resource',
	},
	{
		path: 'setting',
		select: 'groupBy theme thumbnailViewTheme thumbnailBackgroundColor',
	},
];

const playlistPopulateWhenUserHasAccess = [
	{
		path: 'items',
		populate: {
			path: 'resource',
			select:
				'endpoints files markingScheme submissionDeadline title description thumbNailsUrls type liveFrom liveTill liveUrl isEmbeded embedUrlId embedType tags createdBy',
		},
	},
	{
		path: 'setting',
		select: 'groupBy theme thumbnailViewTheme thumbnailBackgroundColor',
	},
];

const playlistProjectionPublic =
	'title resourceType description thumbNailsUrls createdBy setting subject items tags serviceMachineNamesRequired serviceMachineNames accessibleTo';

const playlistProjectionWhenUserHasAccess =
	'title resourceType description thumbNailsUrls createdBy setting items tags serviceMachineNamesRequired serviceMachineNames accessibleTo';

// eslint-disable-next-line camelcase
const unauthorized__getPlaylistsForPhase = (req, res, next) => {
	const { phase } = req.params;
	Playlist.find({
		$and: [{ 'accessibleTo.value': phase }, { 'accessibleTo.type': 'Phase' }],
	})
		.populate(playlistPopulatePublic)
		.select(playlistProjectionPublic)
		.exec((searchError, playlists) => {
			if (searchError) {
				next(new APIError(searchError, 500));
			} else {
				res.send({
					playlistTypeLabels: { Video: 'Videos', ResourceDocument: 'Resources' },
					playlists: playlists.map((playlist) => {
						const hasAccessToContent =
							!playlist.serviceMachineNamesRequired ||
							(playlist.serviceMachineNamesRequired &&
								playlist.serviceMachineNames.some((serviceMachineName) =>
									playlist.accessibleTo
										.filter((a) => a.type === 'Phase')
										.some((accessibleToItem) =>
											userHasAccessToServiceInPhase(
												serviceMachineName,
												accessibleToItem.value,
												req.payload
											)
										)
								));
						return playlist.makeForPublic({ hasAccessToContent });
					}),
				});
			}
		});
};

// eslint-disable-next-line camelcase
const unauthorized__getPlaylist = (req, res) => {
	const { playlistId } = req.query;
	Playlist.findOne({
		_id: playlistId,
	})
		.select(playlistProjectionWhenUserHasAccess)
		.populate(playlistPopulateWhenUserHasAccess)
		.exec((error, playlist) => {
			if (error) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else if (!playlist) {
				res.status(404).send({ message: 'Playlist not found' });
			} else {
				const hasAccessToContent =
					!playlist.serviceMachineNamesRequired ||
					(playlist.serviceMachineNamesRequired &&
						playlist.serviceMachineNames.some((serviceMachineName) =>
							playlist.accessibleTo
								.filter((a) => a.type === 'Phase')
								.some((accessibleToItem) =>
									userHasAccessToServiceInPhase(
										serviceMachineName,
										accessibleToItem.value,
										req.payload
									)
								)
						));

				res.send({ playlist: playlist.makeForPublic({ hasAccessToContent }) });
			}
		});
};

const getVideoCount = (req, res) => {
	const { user } = res.locals;
	const { resourceType } = req.query;
	const { subscriptions } = user;
	const phases = [];
	subscriptions.forEach((subscription) => {
		subscription.subgroups.forEach((subgroup) => {
			subgroup.phases.forEach((phase) => {
				phases.push(phase.phase);
			});
		});
	});

	Playlist.find({
		$and: [
			{ 'accessibleTo.value': { $in: phases } },
			{ 'accessibleTo.type': 'Phase' },
		],
		resourceType,
	}).exec((error, playlists) => {
		if (error) {
			res.status(500).send({ message: 'Some error occurred' });
		} else {
			res.send({
				count: reduce(
					playlists,
					(result, playlist) => result + size(playlist.items),
					0
				),
			});
		}
	});
};

module.exports = {
	getVideoCount,
	unauthorized__getPlaylist,
	unauthorized__getPlaylistsForPhase,
};
