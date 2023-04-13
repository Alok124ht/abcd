import { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { map } from 'lodash';
import APIError from '../../helpers/APIError';
import { Request } from '../../types/Request';
import Assignment from '../models/Assignment';
import UserGroupsCache from '../../cache/UserGroups';

export async function hasAccessToAssignment(
	req: Request,
	_res: Response,
	next: NextFunction
) {
	const assignmentId =
		req.query.assignmentId ||
		req.body.assignmentId ||
		req.query.id ||
		req.body.id;
	const { id: userId, role } = req.payload;
	const query: { _id: any; permissions?: any } = { _id: assignmentId };
	const createdByQuery: { createdBy?: string } = {};
	if (role !== 'super') {
		let groupIdsOfUser;
		try {
			groupIdsOfUser = await UserGroupsCache.getGroupsOfUser(userId);
		} finally {
			const orCondition: any[] = [
				{
					itemType: 'User',
					item: Types.ObjectId(userId),
				},
			];
			if (Array.isArray(groupIdsOfUser) && groupIdsOfUser.length) {
				orCondition.push({
					itemType: 'UserGroup',
					item: { $in: map(groupIdsOfUser, (id) => Types.ObjectId(id)) },
				});
			}
			query.permissions = {
				$elemMatch: {
					$or: orCondition,
				},
			};
		}
		// createdByQuery.createdBy = userId;
	}
	const count = await Assignment.countDocuments({ ...query, ...createdByQuery });
	if (count > 0) {
		next();
	} else {
		next(
			new APIError(
				'Either you do not have permission to access this assignment or it does not exist.',
				422,
				true
			)
		);
	}
}
