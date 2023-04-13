import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Request } from '../types/Request';
import Group from '../models/Mentor/Group';
import APIError from '../helpers/APIError';

export async function checkUserGroup(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { groupId } = req.params;
	const { id: userId } = req.payload;
	if (groupId) {
		try {
			const group = await Group.findOne({
				_id: groupId,
				members: Types.ObjectId(userId),
			});
			if (!group) {
				next(new APIError('Group not found', 400, true));
			} else {
				res.locals.group = group;
				next();
			}
		} catch (e) {
			next(new APIError('Internal server error', 400, true));
		}
	} else {
		res.status(401).send({ message: 'Unauthorized access' });
	}
}
