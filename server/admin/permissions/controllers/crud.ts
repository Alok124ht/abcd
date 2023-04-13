import { Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import APIError from '../../../helpers/APIError';
import { Request } from '../../../types/Request';
import AdminPermissionModel from '../models/AdminPermissionModel';
import AdminPermissionResponseLocal from '../types/AdminPermissionResponseLocal';

export async function create(req: Request, res: Response, next: NextFunction) {
	const { id: userId } = req.payload;
	const { grantedTo, grantedToModel, grantedOn, grantedOnModel } = req.body;

	const alreadyHasAccessToPermission = await AdminPermissionModel.findOne({
		grantedTo: userId,
		grantedToModel: 'User',
		grantedOn: grantedTo,
		grantedOnModel: grantedToModel,
	});
	if (!alreadyHasAccessToPermission) {
		const a = await AdminPermissionModel.create({
			grantedTo: userId,
			grantedToModel: 'User',
			grantedOn: grantedTo,
			grantedOnModel: grantedToModel,
			createdBy: userId,
		});
	}
	const createdPermission = await AdminPermissionModel.create({
		grantedTo,
		grantedToModel,
		grantedOn,
		grantedOnModel,
		createdBy: userId,
	});
	res.send(createdPermission);
}

export async function remove(req: Request, res: Response, next: NextFunction) {
	const { id: adminPermissionId } = req.body;
	try {
		await AdminPermissionModel.remove({ _id: adminPermissionId });
	} catch (e) {
		next(new APIError(e.message, 500, true));
	}
	res.send({ message: 'Removed successfully' });
}

export async function list(
	req: Request,
	res: Response & {
		locals: {
			adminPermission: AdminPermissionResponseLocal;
		};
	},
	next: NextFunction
) {
	const { limit: limitRaw, skip: skipRaw } = req.query;
	const { id: userId } = req.payload;
	const {
		adminPermission: { userGroups },
	} = res.locals;

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

	const permissions = await AdminPermissionModel.find({
		$or: [
			{ grantedTo: { $in: userGroups }, grantedToModel: 'UserGroup' },
			{
				grantedTo: Types.ObjectId(userId),
				grantedToModel: 'User',
			},
		],
	})
		.skip(skip)
		.limit(limit)
		.sort({ _id: -1 })
		.populate([
			{ path: 'grantedTo', select: 'name label email' },
			{ path: 'grantedOn', select: 'name label email' },
		]);
	res.send({ items: permissions });
}

// TODO: handle permissions granted through user groups
export async function listPhasePermissions(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const phaseId = req.params.phaseId;
	const {
		adminPermission: { userGroups, phases },
	} = res.locals;
	// check if user has access to phase
	if (!phases.some((phase) => phase.equals(phaseId))) {
		next(new APIError('You do not have access to this phase'));
		return;
	}
	try {
		const permissions = await AdminPermissionModel.find({
			grantedOn: phaseId,
			grantedOnModel: 'Phase',
		}).populate('grantedTo');
		res.send({ items: permissions, total: permissions.length });
	} catch (e) {
		next(e);
	}
}
