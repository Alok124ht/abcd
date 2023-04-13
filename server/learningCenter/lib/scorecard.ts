import { FilterQuery, Types } from 'mongoose';
import {
	Playlist,
	PlaylistWithItemAndResourcePopulated,
	ResourceType,
} from '../../types/Playlist';
import { createItemsById } from '../../utils/items';
import { getGroupsOfUser } from '../../cache/UserGroups';
import userModel from '../../user/user.model';
import { getActivePhasesFromSubscriptions } from '../../utils/phase';
import PlaylistModel from '../models/Playlist';
import UserVideoStat from '../models/UserVideoStat';
import AssignmentSubmissionModel from '../../assignment/models/AssignmentSubmission';
import {
	calculateGrades,
	generateScorecardConfig,
	getCategorisableItems,
	ScorecardShortConfig,
} from '../utils/scorecardConfig';
import { env } from '../../../config/config';
import { ENVIRONMENT } from '../../../config/ENVIRONMENT';

async function getPlaylistsQuery(
	userId: Types.ObjectId,
	resourceType: ResourceType | ResourceType[]
) {
	const user = await userModel.findById(userId).select('subscriptions');
	const phases = getActivePhasesFromSubscriptions(user.subscriptions);
	const userGroups = await getGroupsOfUser(userId);
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
	if (resourceType) {
		if (Array.isArray(resourceType)) {
			playlistQuery.$and.push({ resourceType: { $in: resourceType } });
		} else {
			playlistQuery.$and.push({ resourceType: resourceType });
		}
	}
	return playlistQuery;
}

const shortConfigGroupsProd: ScorecardShortConfig[] = [
	{
		label: 'Technical Skills',
		tagKey: 'Subject',
		tagValue: 'Technical Skill',
		tagLevel: 'Playlist',
		groupCreator: {
			tagLevel: 'Resource',
			tagKey: 'Topic',
			groupCreator: {
				tagKey: 'SubTopic',
				tagLevel: 'Resource',
				markingScheme: {
					Assignment: 60,
					Attendance: 40,
				},
			},
		},
	},
];

const shortConfigGroupsDev: ScorecardShortConfig[] = [
	{
		label: 'Technical Skill',
		tagKey: 'Subject',
		tagValue: 'Maths',
		tagLevel: 'Playlist',
		groupCreator: {
			tagLevel: 'Resource',
			tagKey: 'Topic',
			groupCreator: {
				tagKey: 'SubTopic',
				tagLevel: 'Resource',
				markingScheme: {
					Assignment: 30,
					Attendance: 30,
					Projects: 35,
					'Mentor Assigned': 5,
				},
			},
		},
	},
];

const configToUse =
	env === ENVIRONMENT.DEV ? shortConfigGroupsDev : shortConfigGroupsProd;

export async function getScorecard(userId: Types.ObjectId) {
	try {
		const userPlaylistsQuery = await getPlaylistsQuery(userId, [
			ResourceType.Video,
			ResourceType.Assignment,
		]);

		const allVideoAndAssignmentPlaylists = await PlaylistModel.find(
			userPlaylistsQuery
		).populate([
			{
				path: 'items',
				populate: { path: 'resource', select: 'title tags markingScheme' },
			},
		]);
		const allUserStats = await UserVideoStat.find(
			UserVideoStat.translateAliases({ user: userId })
		).select('iw djl u v');

		const assignmentSubmissions = await AssignmentSubmissionModel.find({
			user: userId,
		})
			.select('user assignment grades')
			.exec();
		const statsByVideoId = createItemsById(allUserStats, 'v');
		const submissionsByAssignmentId = createItemsById(
			assignmentSubmissions,
			'assignment'
		);
		const categorisableItems = getCategorisableItems(
			(allVideoAndAssignmentPlaylists as unknown) as PlaylistWithItemAndResourcePopulated[]
		);

		const scorecardConfigGroups = configToUse.map((shortConfig) => {
			const configGroup = generateScorecardConfig(categorisableItems, shortConfig);
			if (Array.isArray(configGroup)) {
				throw new Error('Root config item can not be an array');
			}
			return configGroup;
		});

		const scorecards = scorecardConfigGroups.map((config) =>
			calculateGrades(
				categorisableItems,
				config,
				statsByVideoId,
				submissionsByAssignmentId
			)
		);
		return { scorecards, statsByVideoId, submissionsByAssignmentId };
	} catch (e) {
		console.error(e);
		return {
			error: e.message,
		};
	}
}
