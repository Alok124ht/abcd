import { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import APIError from '../../../helpers/APIError';
import { Request } from '../../../types/Request';
import PhaseMentorModel from '../../PhaseMentor';
import { adminHasAccessToPhase } from '../../utils';

export async function addMentorToPhase(
	req: Request & {
		params: {
			phaseId: string;
		};
	},
	res: Response,
	next: NextFunction
) {
	try {
		const { user, subject } = req.body;
		const { phaseId: phase } = req.params;
		if (!user || !subject || !phase) {
			next(new APIError('User, subject, and phase are all required', 422, true));
			return;
		}
		if (!adminHasAccessToPhase(phase, res)) {
			next(new APIError('You do not have access to this phase', 402, true));
			return;
		}
		const phaseMentor = new PhaseMentorModel();
		phaseMentor.user = Types.ObjectId(user);
		phaseMentor.phase = Types.ObjectId(phase);
		phaseMentor.subject = Types.ObjectId(subject);
		try {
			await phaseMentor.save();
			res.send(phaseMentor.toJSON());
		} catch (e) {
			next(new APIError(e.message, 422, true));
		}
	} catch (e) {
		next(new APIError(e.message, 422, true));
	}
}

export async function removeMentorFromPhase(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { _id } = req.body;
	const phaseMentor = await PhaseMentorModel.findById(_id);
	if (!phaseMentor) {
		next(new APIError('Not found', 400, true));
	} else {
		if (!adminHasAccessToPhase(phaseMentor.phase, res)) {
			next(new APIError('You do not have access', 402, true));
		} else {
			try {
				await phaseMentor.remove();
				res.send({ success: true });
			} catch (e) {
				next(new APIError('Failed to remove', 500, true));
			}
		}
	}
}

export async function getMentorsOfPhase(
	req: Request & { params: { phaseId: string } },
	res: Response,
	next: NextFunction
) {
	const { phaseId } = req.params;
	if (!Types.ObjectId.isValid(phaseId)) {
		next(new APIError('Phase is required', 422, true));
		return;
	}
	if (!adminHasAccessToPhase(phaseId, res)) {
		next(new APIError('You do not have to this phase', 402, true));
		return;
	}
	try {
		const phaseMentors = await PhaseMentorModel.find({ phase: phaseId }).populate(
			'user',
			'name email username dp role'
		);
		res.send({ items: phaseMentors, total: phaseMentors.length });
	} catch (e) {
		next(e);
	}
}
