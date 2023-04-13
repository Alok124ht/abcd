import { Response, NextFunction } from 'express';
import { Request } from '../../../types/Request';
import AdminPermissionResponseLocal from '../types/AdminPermissionResponseLocal';
import { getPermissionsOfUser } from '../services/get';

/**
 * This function adds res.locals.permissions object
 * permissions contains phases, users, user groups and users of usergroups
 * added through AdminPerrmission
 */
export async function withAdminPermission(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const permissions: AdminPermissionResponseLocal = await getPermissionsOfUser(
		req.payload.id,
		req.payload.role
	);
	res.locals.adminPermission = permissions;
	next();
}
