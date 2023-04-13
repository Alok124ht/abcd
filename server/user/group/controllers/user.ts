import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { forEach, map } from 'lodash';
import UserToUserGroup from '../../../models/UserToUserGroup';
import { Request } from '../../../types/Request';
import APIError from '../../../helpers/APIError';
import UserGroupModel from '../../../models/UserGroup';
import { getQueryToSearchGroupsThatUserHasAccessTo } from '../utils';
import { clear as clearUserGroupsCache } from '../../../cache/UserGroups';

export async function addUsers(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { userGroup: groupId, users: userIds } = req.body;
	const { id: userId, role } = req.payload;
	const searchQuery = await getQueryToSearchGroupsThatUserHasAccessTo(
		Types.ObjectId(userId),
		role,
		res.locals.adminPermission
	);
	const query = { _id: groupId };

	try {
		const group = await UserGroupModel.findOne({ $and: [searchQuery, query] });
		if (!group) {
			next(new APIError('UserGroup not found', 404, true));
		} else {
			const userToUserGroupItems = map(userIds, (userId) => ({
				user: userId,
				group: groupId,
			}));
			UserToUserGroup.insertMany(userToUserGroupItems, (insertError) => {
				forEach(userIds, (userId) => clearUserGroupsCache(userId));
				if (insertError) {
					next(new APIError(insertError, 422, true));
				} else {
					res.send({ items: userToUserGroupItems });
				}
			});
		}
	} catch (searchError) {
		next(new APIError('Search UserGroup failed', 500));
	}
}

export async function removeUsersFromGroup(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { users: userIds, userGroup: groupId } = req.body;
	const query = { _id: groupId };
	const { id: userId, role } = req.payload;
	const searchQuery = await getQueryToSearchGroupsThatUserHasAccessTo(
		Types.ObjectId(userId),
		role,
		res.locals.adminPermission
	);

	try {
		const group = await UserGroupModel.findOne({ $and: [searchQuery, query] });
		if (!group) {
			next(new APIError('UserGroup not found', 404, true));
		} else {
			UserToUserGroup.deleteMany(
				{ user: userIds, group: groupId },
				(error, result) => {
					if (error) {
						next(new APIError('Error occurred while removing user from group', 500));
					} else if (!result.ok) {
						next(new APIError('User not not found', 404));
					} else {
						forEach(userIds, (userId) => clearUserGroupsCache(userId));
						res.send({ n: result.n, userIds, groupId });
					}
				}
			);
		}
	} catch (searchError) {
		next(new APIError('Search UserGroup failed', 500));
	}
}
