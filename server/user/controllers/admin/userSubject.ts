import { Request } from '../../../types/Request';
import { Response, NextFunction } from 'express';
import UserModel from '../../user.model';
import { FilterQuery } from 'mongoose';
import { IUser } from '../../IUser';
import { createAuthorizedUserFilter } from './search';

export async function updateUserSubjectsBulk(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { subjects, userIds } = req.body;
	const { id: adminId, role } = req.payload;
	const { adminPermission } = res.locals;
	const userIdQuery: FilterQuery<IUser> = {
		$and: [
			createAuthorizedUserFilter(adminPermission, adminId, role),
			{ _id: { $in: userIds } },
		],
	};
	try {
		const result = await UserModel.updateMany(userIdQuery, {
			$set: { subjects },
		}).exec();
		res.send({ result });
	} catch (e) {
		next(e);
	}
}
