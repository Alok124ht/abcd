import CourseFeedback from '../../models/CourseFeedback';
import { Request } from '../../types/Request';
import { Response, NextFunction } from 'express';
import APIError from '../../helpers/APIError';

export function list(req: Request, res: Response, next: NextFunction) {
	const { skip: skipRaw = '0', limit: limitRaw = '0', type } = req.query;
	if (typeof skipRaw !== 'string' || typeof limitRaw !== 'string') {
		next(new APIError('Invalid params', 422));
		return;
	}
	const skip = parseInt(skipRaw, 10);
	const limit = parseInt(limitRaw, 10);
	const query: { [key: string]: string | string[] | any } = {};
	if (
		typeof type === 'string' ||
		(Array.isArray(type) && !type.some((t) => typeof t !== 'string'))
	) {
		query.type = type;
	}
	if (req.query.collegeNames && Array.isArray(req.query.collegeNames)) {
		const collegeNames: string[] = [];
		req.query.collegeNames.forEach(
			(collegeName: any, _index: number, _a: any[]) => {
				collegeNames.push(collegeName);
			}
			// i(\w)*\s*i(\w)*\s*t[\w\s]*k
		);
		query.collegeName = {
			$in: collegeNames.map((collegeName) => {
				let expression = '';
				for (let i = 0; i < collegeName.length; i += 1) {
					if (i != 0) {
						expression += '.*';
					}
					expression += collegeName[i];
				}
				console.log(expression);
				return new RegExp(expression, 'i');
			}),
		};
	}
	if (typeof req.query.name === 'string') {
		query.name = { $regex: new RegExp(req.query.name, 'i') };
	}
	if (typeof req.query.email === 'string') {
		query.email = { $regex: new RegExp(req.query.email, 'i') };
	}
	if (typeof req.query.experience === 'string') {
		query.experience = { $regex: new RegExp(req.query.experience, 'i') };
	}
	CourseFeedback.find(query)
		.skip(skip)
		.limit(limit)
		.sort({ createdAt: -1 })
		.populate([
			{
				path: 'submittedBy',
				select: 'name email subscriptions',
			},
			{
				path: 'user',
				select: 'name email subscriptions',
			},
		])
		.exec((searchError: Error, feedbacks) => {
			if (searchError) {
				next(searchError);
			} else {
				CourseFeedback.countDocuments(query, (error, documentCount) => {
					res.send({
						items: feedbacks,
						total: error ? feedbacks.length : documentCount,
					});
				});
			}
		});
}
