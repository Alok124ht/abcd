import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { forEach, map } from 'lodash';
import UserToUserGroup from '../../../models/UserToUserGroup';
import UserGroupModel from '../../../models/UserGroup';
import { Request } from '../../../types/Request';
import APIError from '../../../helpers/APIError';
import AdminPermissionModel from '../../../admin/permissions/models/AdminPermissionModel';
import UserGroup from '../../../models/UserGroup';
import { getQueryToSearchGroupsThatUserHasAccessTo } from '../utils';
import { clear as clearGroupsCache } from '../../../cache/UserGroups';

export async function createGroup(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { label, users: userIds, isTemporary } = req.body;
	const { id: adminUserId } = req.payload;
	const userGroup = new UserGroupModel({
		label,
		createdBy: adminUserId,
		isTemporary,
	});
	userGroup.version = 2;
	const userToUserGroupItems = map(userIds, (userId) => ({
		user: userId,
		group: userGroup._id,
	}));
	UserToUserGroup.insertMany(userToUserGroupItems, (insertError) => {
		if (insertError) {
			next(new APIError(insertError, 422, true));
		} else {
			userGroup.save(async (saveError) => {
				if (saveError) {
					next(new APIError(saveError, 500));
				} else {
					const adminPermission = new AdminPermissionModel({
						grantedTo: Types.ObjectId(adminUserId),
						grantedToModel: 'User',
						grantedOn: userGroup._id,
						grantedOnModel: 'UserGroup',
						createdBy: adminUserId,
					});
					await adminPermission.save();
					forEach(userIds, (userId) => clearGroupsCache(userId));
					res.send({ userGroup, userToUserGroupItems });
				}
			});
		}
	});
}

export async function listGroups(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { id: userId, role } = req.payload;
	const { limit: limitRaw, skip: skipRaw } = req.query;
	let limit = 10;
	if (typeof limitRaw === 'string') {
		const parsedLimit = parseInt(limitRaw, 10);
		if (!Number.isNaN(parsedLimit)) {
			limit = parsedLimit;
		}
	}
	let skip = 10;
	if (typeof skipRaw === 'string') {
		const parsedSkip = parseInt(skipRaw, 10);
		if (!Number.isNaN(parsedSkip)) {
			skip = parsedSkip;
		}
	}
	try {
		const searchQuery = await getQueryToSearchGroupsThatUserHasAccessTo(
			Types.ObjectId(userId),
			role,
			res.locals.adminPermission
		);
		const total = await UserGroup.countDocuments(searchQuery);
		const userGroups = await UserGroup.find(searchQuery)
			.sort({ _id: -1 })
			.skip(skip)
			.limit(limit);
		res.send({ items: userGroups, searchQuery, total });
	} catch (e) {
		next(e);
	}
}

export async function getNumberOfUsersOfGroup(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { userGroup: userGroupId } = req.query;
	const { id: userId, role } = req.payload;
	const searchQuery = await getQueryToSearchGroupsThatUserHasAccessTo(
		Types.ObjectId(userId),
		role,
		res.locals.adminPermission
	);

	const query = { _id: userGroupId };

	UserGroup.findOne({ $and: [searchQuery, query] })
		.select('_id')
		.then((userGroup) => {
			if (!userGroup) {
				next(new APIError('User Group not found', 422));
			} else {
				UserToUserGroup.count({ group: userGroup._id })
					.then((count) => {
						res.send({ count });
					})
					.catch(next);
			}
		})
		.catch(next);
}

export async function getUserIdsOfGroup(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { userGroup: userGroupId } = req.query;
	const query = { _id: userGroupId };
	const { id: userId, role } = req.payload;
	const searchQuery = await getQueryToSearchGroupsThatUserHasAccessTo(
		Types.ObjectId(userId),
		role,
		res.locals.adminPermission
	);

	UserGroup.findOne({ $and: [searchQuery, query] })
		.select('_id')
		.then((userGroup) => {
			if (!userGroup) {
				next(new APIError('User Group not found', 422));
			} else {
				UserToUserGroup.find({ group: userGroup._id })
					.select('user')
					.then((userToUserGroupItems) => {
						res.send({ items: map(userToUserGroupItems, (item) => item.user) });
					})
					.catch(next);
			}
		})
		.catch(next);
}
