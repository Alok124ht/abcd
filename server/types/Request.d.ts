import { NextFunction, Request as ERequest, Response } from 'express';
import AdminPermissionResponseLocal from '../admin/permissions/types/AdminPermissionResponseLocal';
import { IUser } from '../user/IUser';
import { UserGroupDocument } from './UserGroup';

interface Payload {
	id?: string;
	role?: string;
}

export interface Request extends ERequest {
	payload: Payload;
}

declare global {
	interface ExpressRequest extends ERequest {
		payload: Payload;
	}
	type ExpressResponse = Response & {
		locals: {
			adminPermission?: AdminPermissionResponseLocal;
			user?: IUser;
			/**
			 * user groups of the user
			 */
			userGroups?: string[];
		};
	};
	interface ExpressNextFunction extends NextFunction {}
}
