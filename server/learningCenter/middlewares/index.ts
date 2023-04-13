import { NextFunction } from 'express';
import { FilterQuery, Types } from 'mongoose';
import PlaylistModel from '../models/Playlist';
import { getPermissionsOfUser } from '../../admin/permissions/services/get';
import { Playlist } from '../../types/Playlist';
import { isAtLeast } from '../../utils/user/role';
import { UserRole } from '../../user/IUser';

export async function hasAccessToPlaylist(
	req: ExpressRequest,
	res: ExpressResponse,
	next: NextFunction
) {
	const playlistId = req.params.id || req.body.playlistId || req.body.id;
	const { id: userId, role } = req.payload;
	const permissions = await getPermissionsOfUser(userId, role);
	const permissionQuery: FilterQuery<Playlist> = { _id: playlistId };
	if (!isAtLeast(UserRole.ADMIN, role)) {
		const groupIdsOfUser = permissions.userGroups;

		const orCondition: any[] = [
			{
				itemType: 'User',
				item: Types.ObjectId(userId),
			},
		];
		if (Array.isArray(groupIdsOfUser) && groupIdsOfUser.length) {
			if (!permissionQuery.$or) {
				permissionQuery.$or = [];
			}
			orCondition.push({
				itemType: 'UserGroup',
				item: { $in: groupIdsOfUser },
			});
		}
		permissionQuery.$or = [
			{
				permissions: {
					$elemMatch: {
						$or: orCondition,
					},
				},
			},
		];
		if (Array.isArray(permissions.phases) && permissions.phases.length) {
			if (!permissionQuery.$or) {
				permissionQuery.$or = [];
			}
			permissionQuery.$or.push({
				accessibleTo: {
					$elemMatch: {
						value: { $in: permissions.phases },
					},
				},
			});
		}
	}
	const count = await PlaylistModel.countDocuments(permissionQuery);
	if (count > 0) {
		next();
	} else {
		res.status(422).send({
			message:
				'Either you do not have permission to access this playlist or it does not exist.',
			query: permissionQuery,
			permissions,
		});
	}
}
