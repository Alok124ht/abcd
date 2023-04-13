import { NextFunction, Response } from 'express';
import APIError from '../../helpers/APIError';
import { Request } from '../../types/Request';
import AssessmentWrapper from '../assessmentWrapper.model';
import { clearPhaseWrapperCache } from '../utils/cache';

export async function updateTags(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { wrapperId, tags } = req.body;
	try {
		const wrapper = await AssessmentWrapper.findById(wrapperId).select(
			'tags phases'
		);
		if (!wrapper) {
			throw new Error('Wrapper not found');
		}
		wrapper.tags = tags;
		try {
			await wrapper.save();
			clearPhaseWrapperCache(wrapper.phases.map((p) => p.phase));
		} catch (e) {
			next(new APIError('Failed to save wrapper', 500, true));
		}
		res.send(wrapper);
	} catch (e) {
		next(new APIError(e.message, 400, true));
	}
}
