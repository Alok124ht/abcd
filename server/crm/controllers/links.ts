import { NextFunction, Response } from 'express';
import { getRandomString } from '../../utils/string';
import { Request } from '../../types/Request';
import ShortLinkModel, { ShortLink } from '../models/ShortLink';
import APIError from '../../helpers/APIError';
import { FilterQuery, Types } from 'mongoose';
import { isAtLeast } from '../../utils/user/role';
import { UserRole } from '../../user/IUser';
import { map } from 'lodash';
import UserModel from '../../user/user.model';

export async function createShortLink(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { id: userId } = req.payload;
	const { type, url, description } = req.body;
	const shortLink = new ShortLinkModel({
		type,
		url,
		description,
		createdBy: userId,
	});
	const key = getRandomString(4);
	shortLink.key = key;
	try {
		await shortLink.save();
		res.send({ item: shortLink });
	} catch (e) {
		next(e);
	}
}

export async function updateShortLink(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { role, id: userId } = req.payload;
	const { _id, type, url, description } = req.body;
	const query: FilterQuery<ShortLink> = {};
	if (!isAtLeast(UserRole.ADMIN, role)) {
		query.createdBy = userId;
	}
	query._id = _id;
	const shortLink = await ShortLinkModel.findOne(query);
	if (!shortLink) {
		next(new APIError('ShortLink not found'));
	} else {
		shortLink.type = type;
		shortLink.url = url;
		shortLink.description = description;
		try {
			await shortLink.save();
			res.send({ item: shortLink });
		} catch (e) {
			next(new APIError('Failed to update ShortLink', 422, true));
		}
	}
}

export async function getShortLinks(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const { role, id: userId } = req.payload;
		const { skip: skipRaw, limit: limitRaw, q, users, includeUsers } = req.query;
		if (typeof skipRaw !== 'string' || typeof limitRaw !== 'string') {
			next(new APIError('Skip and limit must be provided'));
			return;
		}
		const skip = parseInt(skipRaw, 10);
		const limit = parseInt(limitRaw, 10);
		const query: FilterQuery<ShortLink> = {};
		if (!isAtLeast(UserRole.ADMIN, role)) {
			query.createdBy = Types.ObjectId(userId);
		}
		if (Array.isArray(users) && users.length) {
			const userIds: Types.ObjectId[] = map(users, (u) =>
				typeof u === 'string' && Types.ObjectId.isValid(u)
					? Types.ObjectId(u)
					: null
			).filter((u) => u);
			query.createdBy = { $in: userIds };
		}
		if (typeof q === 'string' && q && q.trim()) {
			if (!query.$or) {
				query.$or = [];
			}
			const trimmedQ = q.trim();
			const searchRegex = {
				$regex: new RegExp(trimmedQ, 'i'),
			};
			query.$or.push({ url: searchRegex });
			query.$or.push({ key: searchRegex });
			query.$or.push({ type: searchRegex });
			if (Types.ObjectId.isValid(q)) {
				query.$or.push({ _id: Types.ObjectId(q) });
			}
		}
		try {
			const total = await ShortLinkModel.countDocuments(query);
			if (!total) {
				// just to reduce one query
				res.send({ total, items: [] });
			} else {
				let allUserIds: Types.ObjectId[] = [];
				if (includeUsers === '1') {
					allUserIds = await ShortLinkModel.distinct('createdBy');
				}
				const items = await ShortLinkModel.find(query)
					.skip(skip)
					.limit(limit)
					.sort({ _id: -1 })
					.populate('createdBy', 'name email');
				const users = await UserModel.find({ _id: { $in: allUserIds } }).select(
					'name email'
				);
				res.send({ items, total, users });
			}
		} catch (e) {
			next(e);
		}
	} catch (e) {
		next(e);
	}
}
