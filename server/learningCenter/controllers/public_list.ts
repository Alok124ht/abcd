import { FilterQuery, Types } from 'mongoose';
import { map } from 'lodash';
import { Playlist } from '../../types/Playlist';
import { parseAsString } from '../../utils/query';
import { UserRole, IUser } from '../../user/IUser';
import { isAtLeast } from '../../utils/user/role';
import PlaylistModel from '../models/Playlist';
import { userHasAccessToServiceInPhase } from '../../utils/user/servicePlans';
import PhaseMentorModel from '../../phase/PhaseMentor';

const getAllPhases = (user: IUser) => {
	const phases: Types.ObjectId[] = [];
	user.subscriptions.forEach((subscription) => {
		subscription.subgroups.forEach((subgroup) => {
			subgroup.phases.forEach((phase) => {
				phases.push(phase.phase);
			});
		});
	});
	return phases;
};

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

const playlistProjectionPublic =
	'title resourceType description thumbNailsUrls createdBy setting subject items tags serviceMachineNamesRequired serviceMachineNames accessibleTo';

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

const playlistProjectionWhenUserHasAccess =
	'title resourceType description thumbNailsUrls createdBy setting items tags serviceMachineNamesRequired serviceMachineNames accessibleTo';

/**
Public endpoint
 */
export async function getPlaylists(req: ExpressRequest, res: ExpressResponse) {
	const { user, userGroups } = res.locals;
	const { role } = user;
	const { viewAs } = req.query;
	const viewForPhases = parseAsString(req.query.phases);
	const { subscriptions } = user;
	let phases: Types.ObjectId[] = [];
	let { subjects } = user;
	subscriptions.forEach((subscription) => {
		subscription.subgroups.forEach((subgroup) => {
			subgroup.phases.forEach((phase) => {
				phases.push(phase.phase);
			});
		});
	});

	let hasAccessToAllTheContent = false;
	if (isAtLeast(UserRole.MENTOR, role) && viewForPhases && viewAs === 'userOf') {
		hasAccessToAllTheContent = true;
		let parsedPhases = [];
		try {
			parsedPhases = JSON.parse(viewForPhases);
			// eslint-disable-next-line no-empty
		} catch (e) {}
		if (Array.isArray(parsedPhases)) {
			phases = parsedPhases;
			if (!isAtLeast(UserRole.MODERATOR, role)) {
				try {
					const subjectPermissions = await PhaseMentorModel.find({
						user: user._id,
						phase: { $in: phases },
					});
					const subjectAssignedToMentor = subjectPermissions.map(
						(permission) => permission.subject
					);
					subjects = subjectAssignedToMentor;
				} catch (e) {}
			}
		}
	}

	const playlistQuery: FilterQuery<Playlist> = {
		$and: [
			{
				$or: [
					{
						'accessibleTo.value': { $in: phases },
						'accessibleTo.type': 'Phase',
					},
					{
						'accessibleTo.value': { $in: userGroups },
						'accessibleTo.type': 'UserGroup',
					},
					{
						'accessibleTo.value': user._id,
						'accessibleTo.type': 'User',
					},
				],
			},
		],
	};

	if (subjects && subjects.length) {
		playlistQuery.$and.push({
			$or: [
				{ subject: { $in: subjects } },
				{ subject: { $exists: false } },
				{ subject: null },
			],
		});
	}

	PlaylistModel.find(playlistQuery)
		.populate(playlistPopulatePublic)
		.select(playlistProjectionPublic)
		.exec((error, playlists) => {
			if (error) {
				res.status(500).send({ message: 'Some error occurred' });
			} else {
				res.send({
					subjects,
					playlistQuery,
					playlistTypeLabels: {
						Video: 'Videos',
						ResourceDocument: 'Documents',
						Assignment: 'Assignments',
					},

					playlists: playlists.map((playlist) => {
						const hasAccessToContent =
							hasAccessToAllTheContent ||
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
						return playlist.makeForPublic({
							hasAccessToContent,
							phases: map(phases, (phase) => phase.toString()),
						});
					}),
				});
			}
		});
}

/**
Public endpoint
 */
export async function getPlaylist(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const playlistId = req.params.id;
	const { user, userGroups } = res.locals;
	const { role } = user;
	const { viewAs } = req.query;
	const viewForPhases = parseAsString(req.query.phases);
	let phases = getAllPhases(user);
	let hasAccessToAllTheContent = false;
	if (isAtLeast(UserRole.MENTOR, role) && viewForPhases && viewAs === 'userOf') {
		hasAccessToAllTheContent = true;
		let parsedPhases = [];
		try {
			parsedPhases = JSON.parse(viewForPhases);
			// eslint-disable-next-line no-empty
		} catch (e) {}
		if (Array.isArray(parsedPhases)) {
			phases = parsedPhases;
		}
	}
	PlaylistModel.findOne({
		$and: [
			{
				$or: [
					{
						'accessibleTo.value': { $in: phases },
						'accessibleTo.type': 'Phase',
					},
					{
						'accessibleTo.value': { $in: userGroups },
						'accessibleTo.type': 'UserGroup',
					},
					{
						'accessibleTo.value': user._id,
						'accessibleTo.type': 'User',
					},
				],
			},
			{ _id: playlistId },
		],
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
					hasAccessToAllTheContent ||
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

				res.send({
					playlist: playlist.makeForPublic({
						hasAccessToContent,
						phases: map(phases, (phase) => phase.toString()),
					}),
				});
			}
		});
}
