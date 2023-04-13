import { NextFunction, Response } from 'express';
import CourseQuery from '../../../models/CourseQuery';
import { Request } from '../../../types/Request';

export async function getCourseQueries(
	req: Request & {
		query: {
			skip: string;
			limit: string;
			q?: string;
		};
	},
	res: Response,
	next: NextFunction
) {
	const { q, skip: skipRaw, limit: limitRaw } = req.query;
	const query: { [key: string]: any } = {};

	if (typeof q === 'string' && q) {
		const regex = {
			$regex: new RegExp(q, 'i'),
		};
		query['$or'] = [
			{
				name: regex,
			},
			{
				mobileNumber: regex,
			},
			{
				email: regex,
			},
		];
	}

	const skip = isNaN(parseInt(skipRaw, 10)) ? 0 : parseInt(skipRaw, 10);
	const limit = isNaN(parseInt(limitRaw, 10)) ? 0 : parseInt(limitRaw, 10);

	try {
		const applications = await CourseQuery.find(query)
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 })
			.populate([
				{ path: 'user', select: 'email name mobileNumber subscriptions' },
				{ path: 'course' },
			]);
		const count = await CourseQuery.countDocuments(query);
		res.send({ items: applications, count });
	} catch (e) {
		next(e);
	}
}
