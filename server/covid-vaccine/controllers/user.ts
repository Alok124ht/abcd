import { NextFunction, Response } from 'express';
import { Request } from '../../types/Request';
import { getOrRegisterUser } from '../lib/user';

export async function register(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const vaccineUser = await getOrRegisterUser(req.body);
		res.send(vaccineUser);
	} catch (e) {
		next(e);
	}
}
