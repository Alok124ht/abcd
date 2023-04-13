import { Request } from '../../types/Request';
import { Response, NextFunction } from 'express';
import {
	AssessmentConfig,
	AssessmentMarkingScheme,
} from '../../types/AssessmentCore';
import AssessmentCore from '../assessmentCore.model';
import APIError from '../../helpers/APIError';

export async function updateConfig(
	req: Request & {
		body: { assessmentCoreId: string; config: AssessmentConfig };
	},
	res: Response,
	next: NextFunction
) {
	const { assessmentCoreId, config } = req.body;
	const assessmentCore = await AssessmentCore.findById(assessmentCoreId);
	if (!assessmentCore) {
		next(new APIError('Assessment core not found', 404, true));
	}
	assessmentCore.config = config;
	await assessmentCore.save();
	res.send(assessmentCore);
}
export async function updateMarkingScheme(
	req: Request & {
		body: { assessmentCoreId: string; markingScheme: AssessmentMarkingScheme };
	},
	res: Response,
	next: NextFunction
) {
	const { assessmentCoreId, markingScheme } = req.body;
	const assessmentCore = await AssessmentCore.findById(assessmentCoreId);
	if (!assessmentCore) {
		next(new APIError('Assessment core not found', 404, true));
	}
	assessmentCore.markingScheme = markingScheme;
	await assessmentCore.save();
	res.send(assessmentCore);
}
