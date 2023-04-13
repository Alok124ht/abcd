import { Request } from '../../types/Request';
import { NextFunction, Response } from 'express';
import CourseApplication, {
	ApplicationState,
	applicationStateValues,
} from '../../models/CourseApplication';

export async function getApplications(
	req: Request & {
		query: {
			skip: string;
			limit: string;
			q?: string;
			paymentMethods?: string[];
			graduationYears?: string[];
			states?: string[];
		};
	},
	res: Response,
	next: NextFunction
) {
	const {
		q,
		paymentMethods,
		skip: skipRaw,
		limit: limitRaw,
		graduationYears,
		states,
	} = req.query;
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
			{
				collegeName: regex,
			},
			{
				note: regex,
			},
		];
	}
	if (paymentMethods && Array.isArray(paymentMethods) && paymentMethods.length) {
		query.paymentMethod = { $in: paymentMethods };
	}
	if (
		graduationYears &&
		Array.isArray(graduationYears) &&
		graduationYears.length
	) {
		query.graduationYear = { $in: graduationYears.map((y) => parseInt(y, 10)) };
	}
	if (Array.isArray(states) && states.length) {
		query.state = {
			$in: states,
		};
	}
	const skip = isNaN(parseInt(skipRaw, 10)) ? 0 : parseInt(skipRaw, 10);
	const limit = isNaN(parseInt(limitRaw, 10)) ? 0 : parseInt(limitRaw, 10);

	try {
		const applications = await CourseApplication.find(query)
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 })
			.populate([
				{ path: 'user', select: 'email name mobileNumber subscriptions' },
				{ path: 'course' },
			]);
		const count = await CourseApplication.countDocuments(query);
		res.send({ items: applications, count, applicationStateValues });
	} catch (e) {
		next(e);
	}
}

export async function updateState(
	req: Request & { body: { state: string; applicationId: string } },
	res: Response,
	next: NextFunction
) {
	const { state, applicationId } = req.body;
	try {
		const application = await CourseApplication.findById(applicationId);
		application.stateHistory.push({
			state: application.state || ApplicationState.applied,
			createdAt: new Date(),
		});
		application.set('state', state);
		application.save();
		res.send(application);
	} catch (e) {
		next(e);
	}
}

export async function updateNote(
	req: Request & { body: { note: string; applicationId: string } },
	res: Response,
	next: NextFunction
) {
	const { note, applicationId } = req.body;
	try {
		const application = await CourseApplication.findById(applicationId);
		application.noteHistory.push({
			note: application.note,
			createdAt: new Date(),
		});
		application.set('note', note);
		application.save();
		res.send(application);
	} catch (e) {
		next(e);
	}
}
