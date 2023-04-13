import { FilterQuery, Types } from 'mongoose';
import { UserGroupDocument } from '../../../types/UserGroup';
import AdminPermissionResponseLocal from '../../../admin/permissions/types/AdminPermissionResponseLocal';
import { UserRole } from '../../../user/IUser';

export async function getQueryToSearchGroupsThatUserHasAccessTo(
	userId: Types.ObjectId,
	role: UserRole | string,
	adminPermission: AdminPermissionResponseLocal
): Promise<FilterQuery<UserGroupDocument>> {
	if (role === UserRole.SUPER) {
		return {};
	}
	const legacyFilter = {
		$and: [
			{
				createdBy: userId,
			},
			{
				$or: [{ version: 1 }, { version: { $exists: false } }],
			},
		],
	};
	const filter: FilterQuery<UserGroupDocument> = {
		$or: [
			{
				_id: { $in: adminPermission.userGroups },
			},
			legacyFilter,
		],
	};
	return filter;
}
