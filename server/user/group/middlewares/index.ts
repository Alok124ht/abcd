import { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { Request } from '../../../types/Request';
import { getQueryToSearchGroupsThatUserHasAccessTo } from '../utils';

/**
 * Add userGroup to res.locals as res.locals.userGroup
 * if user has access to userGroup
 */
export async function withUserGroup(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { userGroup: userGroupId } = req.body;
	next();
}
