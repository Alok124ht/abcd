import { Response, NextFunction } from 'express';
import { FilterQuery, Types } from 'mongoose';
import AdminPermissionResponseLocal from '../../admin/permissions/types/AdminPermissionResponseLocal';
import APIError from '../../helpers/APIError';
import { Request } from '../../types/Request';
import Announcement from '../models/Announcement';
import { AnnouncementDocument } from '../../types/Announcement';
import { isAtLeast } from '../../utils/user/role';
import { UserRole } from '../../user/IUser';

export async function createAnnouncement(
	req: Request,
	res: Response & {
		locals: {
			adminPermission: AdminPermissionResponseLocal;
			phases: string[];
		};
	},
	next: NextFunction
) {
	const {
		title,
		body,
		files,
		phases: phaseIds,
		categories,
	}: {
		title: string;
		body: string;
		files: { name: string; url: string; type: string; extension: string }[];
		phases: string[];
		categories: string[];
	} = req.body;
	const { adminPermission, phases: allPhases } = res.locals;
	const { id } = req.payload;

	if (!phaseIds || !phaseIds.length)
		return res.status(422).send({ message: 'Please select at least one Phase' });

	if (!title || !body)
		return res.status(422).send({ message: 'Please send proper parameters!' });

	if (
		!phaseIds.every(
			(phaseId) =>
				adminPermission.phases.some((phase) => phase.equals(phaseId)) ||
				allPhases.some((phase) => phase.toString() === phaseId)
		)
	) {
		next(
			new APIError(
				'You do not have permission to publish to one or more phases',
				401,
				true
			)
		);
		return;
	}

	try {
		const announcement = new Announcement();
		announcement.body = body;
		announcement.title = title;
		announcement.files = files;
		announcement.visibleTo = phaseIds.map((phaseId) => ({
			value: Types.ObjectId(phaseId),
			type: 'Phase',
		}));
		announcement.categories = categories;
		announcement.createdBy = Types.ObjectId(id);
		try {
			await announcement.save();
			res.send(announcement);
		} catch (e) {
			next(e);
		}
	} catch (e) {
		next(new APIError('Unknown error'));
	} finally {
		next(new APIError('Unknown error. Caught in final.'));
	}
}

export const archive = (req: Request, res: Response) => {
	const { id: _id, archive, restore } = req.query;

	if (!_id || (!archive && !restore))
		return res.send({ success: false, msg: 'Please send proper parameters!' });

	const operation = archive ? 'delete' : 'restore';
	Announcement.findById({ _id })
		.then(async (announcement) => {
			if (!announcement)
				return res.send({ success: false, msg: 'Annoncement not found!' });
			announcement.set('isArchived', archive ? true : false);
			announcement.save((err, saved) => {
				if (saved) res.send({ success: true, msg: `Successfully ${operation}d!` });
				else res.send({ success: false, msg: `Fail to ${operation}` });
			});
		})
		.catch((err) => {
			res.send({ success: false, msg: `Error on ${operation}!` });
		});
};

export async function updateAnnouncement(
	req: Request,
	res: Response & {
		locals: {
			adminPermission: AdminPermissionResponseLocal;
			phases: Types.ObjectId[];
		};
	},
	next: NextFunction
) {
	const {
		_id: announcementId,
		title,
		body,
		files,
		phases: phaseIds,
		categories,
	}: {
		_id: string;
		title: string;
		body: string;
		files: { name: string; url: string; type: string; extension: string }[];
		phases: string[];
		categories: string[];
	} = req.body;

	const { role } = req.payload;
	const { adminPermission, phases: allUserPhases } = res.locals;

	const filterQuery = createFilterQuery(role, adminPermission, allUserPhases);
	filterQuery._id = announcementId;

	try {
		const announcement = await Announcement.findById(filterQuery);
		if (!announcement) {
			throw new APIError('Announcement not found');
		}
		announcement.body = body;
		announcement.title = title;
		announcement.files = files;
		announcement.visibleTo = phaseIds.map((phaseId) => ({
			value: Types.ObjectId(phaseId),
			type: 'Phase',
		}));
		announcement.categories = categories;
		try {
			await announcement.save();
			res.send(announcement);
		} catch (e) {
			next(e);
		}
	} catch (e) {
		next(e);
	}
}

export async function listAnnouncements(
	req: Request,
	res: Response & {
		locals: {
			adminPermission: AdminPermissionResponseLocal;
			phases: string[];
		};
	},
	next: NextFunction
) {
	const { role } = req.payload;
	const { skip: skipRaw, limit: limitRaw, phases: searchedPhases } = req.query;
	const { adminPermission, phases: allUserPhases } = res.locals;
	if (typeof skipRaw !== 'string' || typeof limitRaw !== 'string') {
		next(new APIError('Skip must be a number', 422, true));
		return;
	}

	const skip = Number.parseInt(skipRaw);
	const limit = Number.parseInt(limitRaw);

	const filterQuery = createFilterQuery(
		role,
		adminPermission,
		allUserPhases.map((p) => Types.ObjectId(p)),
		Array.isArray(searchedPhases)
			? searchedPhases.map((phaseId: any) => Types.ObjectId(phaseId))
			: undefined
	);
	const finalQuery: any = { ...filterQuery };
	if (!['admin', 'super'].includes(role)) finalQuery.isArchived = { $ne: true };

	try {
		const total = await Announcement.countDocuments(finalQuery);
		const announcements = await Announcement.find(finalQuery)
			.limit(limit)
			.skip(skip)
			.sort({ _id: -1 })
			.populate('createdBy', 'dp name username');
		res.send({ items: announcements, total: total });
	} catch (e) {
		next(e);
	}
}

const createFilterQuery = (
	userRole: string,
	adminPermission: AdminPermissionResponseLocal,
	phases: Types.ObjectId[],
	searchedPhases?: Types.ObjectId[]
): FilterQuery<AnnouncementDocument> => {
	if (isAtLeast(UserRole.SUPER, userRole)) {
		const filter: FilterQuery<AnnouncementDocument> = {};
		if (searchedPhases && searchedPhases.length)
			filter.visibleTo = { $elemMatch: { value: { $in: searchedPhases } } };
		return filter;
	}
	let allPhases = adminPermission.phases;
	if (isAtLeast(UserRole.MODERATOR, userRole)) {
		allPhases = phases;
	}
	const filteredPhases =
		searchedPhases && searchedPhases.length
			? allPhases.filter((phase) => searchedPhases.some((p) => p.equals(phase)))
			: allPhases;
	const filter: FilterQuery<AnnouncementDocument> = {
		visibleTo: { $elemMatch: { value: { $in: filteredPhases } } },
	};
	return filter;
};
