import Log from '../../../log/log.model';
import { Request } from '../../../types/Request';
import { Response, NextFunction } from 'express';
import { isAtLeast } from '../../../utils/user/role';
import APIError from '../../../helpers/APIError';
import { FilterQuery } from 'mongoose';
import { IUser } from '../../IUser';
import UserModel from '../../user.model';

export async function changeRole(
	req: Request,
	res: Response,
	next: NextFunction
) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users${req.url}`,
		params: req.body,
	});
	const {
		payload: { role },
	} = req;
	const { role: roleToBeAssigned, user: userId } = req.body;
	if (!isAtLeast(roleToBeAssigned, role, 1)) {
		next(
			new APIError(
				`You do not have permission to assign this role("${roleToBeAssigned}").`,
				422,
				true
			)
		);
		return;
	}
	if (!userId) {
		next(new APIError('Please select a user', 422, true));
		return;
	}
	const user = await UserModel.findOne({ _id: userId }).select('role');
	if (isAtLeast(user.role, role, 1)) {
		user.role = roleToBeAssigned;
		try {
			await user.save();
			res.send({ success: true });
		} catch (e) {
			next(e);
		}
	} else {
		next(
			new APIError('You do not permission to change role of this user', 422, true)
		);
	}
}
