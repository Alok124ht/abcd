/**
 * This contains methods related to Course Plan created from Videos and Assignments
 */
import { NextFunction, Response } from 'express';
import { forEach, get } from 'lodash';
import { Tag } from '../../types/Tag';
import { Request } from '../../types/Request';
import Playlist from '../models/Playlist';
import { getTagValueByKey } from '../../utils/tags';
import moment, { Moment } from 'moment';
import { getAvailableFrom, getAvailableTill } from '../utils/availability';
import { ResourceType } from 'server/types/Playlist';

const createCoursePlanFromPlaylists = async (
	playlists: {
		items: {
			availableFrom: Date;
			availableTill: Date;
			availableFromByPhase: {
				[phaseId: string]: Date;
			};
			availableTillByPhase: {
				[phaseId: string]: Date;
			};
			resource: { title: string; tags: Tag[] };
			resourceModel: string;
			tags: Tag[];
		}[];
		tags: Tag[];
		title: string;
		resourceType: string;
		_id: string;
	}[],
	phaseId: string
) => {
	const allItems: {
		availableFrom: Date;
		availableTill: Date;
		resource: { title: string; tags: Tag[] };
		resourceModel: string;
		tags: Tag[];
		topic: string;
		subject: string;
		date: Moment;
		playlistId: string;
	}[] = [];

	forEach(playlists, (playlist) => {
		forEach(get(playlist, ['items']), (item) => {
			const availableFrom = getAvailableFrom(item, [phaseId]);
			const availableTill = getAvailableTill(item, [phaseId]);
			allItems.push({
				...item,
				availableFrom,
				availableTill,
				topic: playlist.title,
				subject: getTagValueByKey(playlist.tags, 'Subject'),
				date: moment(availableFrom),
				playlistId: playlist._id.toString(),
			});
		});
	});

	allItems.sort((item1, item2) => {
		if (item1.date.isBefore(item2.date)) {
			return -1;
		}
		if (item1.date.isAfter(item2.date)) {
			return 1;
		}
		return 0;
	});

	return allItems;
};

export async function getCoursePlanOfPhase(req: Request, res: Response) {
	const { phaseId } = req.params;
	const allPlaylists = await Playlist.find({
		'accessibleTo.value': phaseId,
		resourceType: { $in: [ResourceType.Video, ResourceType.Assignment] },
	})
		.select('items tags title accessibleTo resourceType')
		.populate({
			path: 'items',
			select:
				'availableFrom availableTill availableFromByPhase availableTillByPhase resource resourceModel tags',
			populate: {
				path: 'resource',
				select: 'title tags',
			},
		});
	const coursePlan = await createCoursePlanFromPlaylists(
		allPlaylists.map((playlist) => playlist.toObject({})),
		phaseId
	);

	res.send({ items: coursePlan, now: new Date() });
}
