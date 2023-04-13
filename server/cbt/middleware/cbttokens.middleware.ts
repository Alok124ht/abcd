import { Request, Response, NextFunction } from 'express';
import { CbtTokenModel } from '../models/CbtToken.model';

export const validateToken = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	let token = null;
	if (req.body.token) {
		token = req.body.token;
	} else if (req.query.token) {
		token = req.query.token;
	}

	if (!token) {
		res.send({ success: false, msg: 'Token not found' });
	}

	CbtTokenModel.findOne({ token, active: true }).then((tokens) => {
		if (tokens) {
			// @ts-ignore
			req.payload = {
				client: tokens.client,
			};
			next();
		} else {
			res.send({ success: false, msg: 'Token not found' });
		}
	});
};
