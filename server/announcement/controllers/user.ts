import { Response, NextFunction } from 'express';
import { IUser } from '../../user/IUser';
import { Request } from '../../types/Request';
import { getActivePhasesFromSubscriptions } from '../../utils/phase';
import AnnouncementModel from '../models/Announcement';
import { FilterQuery, Types } from 'mongoose';
import { AnnouncementDocument } from 'server/types/Announcement';
import APIError from '../../helpers/APIError';

export async function getAnnouncements(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { phase: phaseId, skip: skipRaw, limit: limitRaw } = req.params;
	if (typeof skipRaw !== 'string' || typeof limitRaw !== 'string') {
		next(new APIError('Skip must be a number', 422, true));
		return;
	}

	const skip = Number.parseInt(skipRaw);
	const limit = Number.parseInt(limitRaw);
	if (Number.isNaN(skip) || Number.isNaN(limit)) {
		next(new APIError('Limit and skip are not numbers'));
		return;
	}
	const filters: FilterQuery<AnnouncementDocument> = {
		visibleTo: { $elemMatch: { value: phaseId } },
	};
	try {
		const total = await AnnouncementModel.countDocuments(filters);
		const announcements = await AnnouncementModel.find(filters)
			.limit(limit)
			.skip(skip)
			.sort({ _id: -1 })
			.populate('createdBy', 'dp username name');
		res.send({ items: announcements, total });
	} catch (e) {
		next(new APIError('Unknown error occurred. Please try again.', 500, true));
	}
}

export async function getAnnouncement(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { announcementId } = req.params;
	if (!Types.ObjectId.isValid(announcementId)) {
		next(new APIError('Invalid announcement id'));
		return;
	}
	try {
		const announcement = await AnnouncementModel.findById(announcementId);
		res.send(announcement);
	} catch (e) {
		next(e);
	}
}
