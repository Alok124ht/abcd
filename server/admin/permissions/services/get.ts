import { Types } from 'mongoose';
import { getGroupsOfUser } from '../../../cache/UserGroups';
import AdminPermissionModel from '../models/AdminPermissionModel';
import AdminPermissionResponseLocal from '../types/AdminPermissionResponseLocal';
import UserToUserGroupModel from '../../../models/UserToUserGroup';
import ClientModel from '../../../client/client.model';
import { UserRole } from '../../../user/IUser';
import { isAtLeast } from '../../../utils/user/role';

export async function getPermissionsOfUser(
	userId: string | Types.ObjectId,
	role: UserRole
): Promise<AdminPermissionResponseLocal> {
	const adminId = typeof userId === 'string' ? Types.ObjectId(userId) : userId;
	const groups = await getGroupsOfUser(adminId);
	const permissionDocuments = await AdminPermissionModel.find({
		$or: [
			{
				grantedTo: groups,
				grantedToModel: 'UserGroup',
			},
			{
				grantedTo: adminId,
				grantedToModel: 'User',
			},
		],
	});
	const permissions: AdminPermissionResponseLocal = {
		phases: [],
		users: [],
		userGroups: [],
		usersOfUserGroups: [],
	};

	if (!isAtLeast(UserRole.ADMIN, role)) {
		const client = await ClientModel.findOne({ moderators: { $in: [adminId] } });
		if (client) {
			client.phases.forEach((phase) => {
				permissions.phases.push(phase);
			});
		}
	}

	permissionDocuments.forEach((item) => {
		switch (item.grantedOnModel) {
			case 'Phase':
				permissions.phases.push(item.grantedOn);
				break;
			case 'UserGroup':
				permissions.userGroups.push(item.grantedOn);
				break;
			case 'User':
				permissions.users.push(item.grantedOn);
				break;
		}
	});

	if (permissions.userGroups.length) {
		const items = await UserToUserGroupModel.find({
			group: { $in: permissions.userGroups },
		});
		const groupUsers: string[] = [];
		items.forEach((item) => {
			const user = item.user.toString();
			if (!groupUsers.includes(user)) {
				groupUsers.push(user);
			}
		});
		permissions.usersOfUserGroups = groupUsers.map((u) => Types.ObjectId(u));
	}
	return permissions;
}
