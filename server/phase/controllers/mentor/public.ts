import { NextFunction, Response } from 'express';
import APIError from '../../../helpers/APIError';
import PhaseMentorModel from '../../../phase/PhaseMentor';
import { Request } from '../../../types/Request';

export async function getMentorsOfPhase(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { phaseId } = req.params;
	try {
		const items = await PhaseMentorModel.find({ phase: phaseId })
			.populate('user', 'name username dp')
			.exec();
		res.send({ items, total: items.length });
	} catch (e) {
		next(new APIError('Failed to fetch', 422, false));
	}
}
