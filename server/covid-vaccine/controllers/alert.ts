import { NextFunction, Response } from 'express';
import APIError from '../../helpers/APIError';
import { Request } from '../../types/Request';
import AlertStat from '../models/AlertStat';

export async function getAlertStatByKey(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const key = req.query.key;
	if (typeof key !== 'string') {
		next(new APIError('Key is not a string', 422, true));
	}
	const alertStat = await AlertStat.findOne({ key });
	if (alertStat) {
		res.send(alertStat);
	} else {
		next(new APIError('Alert not found', 400, true));
	}
}
