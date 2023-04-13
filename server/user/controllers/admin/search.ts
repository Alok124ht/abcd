import { FilterQuery, Types } from 'mongoose';
import Client from '../../../client/client.model';
import { isAtLeast, isEqualOrBelow } from '../../../utils/user/role';
import { Request } from '../../../types/Request';
import { Response, NextFunction } from 'express';
import { IUser, UserRole } from '../../IUser';
import UserModel from '../../user.model';
import { getStrippedEmail } from '../../../utils/user/email';
import { forEach, isEmpty, map } from 'lodash';
import APIError from '../../../helpers/APIError';
import SubmissionModel from '../../../assessment/submission.model';
import AdminPermissionResponseLocal from '../../../admin/permissions/types/AdminPermissionResponseLocal';
import tokenModel from '../../../token/token.model';
import { getClientOfUser } from '../../../user/utils/user';

export async function createAuthorizedUserFilter(
	adminPermission: AdminPermissionResponseLocal,
	adminId: string,
	role: string
): Promise<FilterQuery<IUser>> {
	if (isEqualOrBelow(UserRole.MODERATOR, role)) {
		const client = await Client.findOne(
			{ moderators: adminId },
			{ phases: 1, name: 1 }
		).exec();
		if (client) {
			if (role === 'moderator') {
				return {
					$or: [
						{
							'subscriptions.subgroups.phases.phase': {
								$in: [...adminPermission.phases, ...client.phases],
							},
						},
						{
							_id: {
								$in: [...adminPermission.users, ...adminPermission.usersOfUserGroups],
							},
						},
					],
				};
			}
		}
		if (role === UserRole.ACCOUNT_STAFF) {
			const { client } = await getClientOfUser(adminId);
			if (client) {
				return {
					$or: [
						{ 'subscriptions.subgroups.phases.phase': { $in: [...client.phases] } },
					],
				};
			}
		}
		return {
			$or: [
				{
					'subscriptions.subgroups.phases.phase': { $in: adminPermission.phases },
				},
				{
					_id: {
						$in: [...adminPermission.users, ...adminPermission.usersOfUserGroups],
					},
				},
			],
		};
	}

	return null;
}

export const searchUser = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const { role, id } = req.payload;
	const { adminPermission } = res.locals;

	const authorizationQuery = await createAuthorizedUserFilter(
		adminPermission,
		id,
		role
	);

	const {
		limit: rawLimit = 100,
		isAccessGranted,
		phases,
		q = '',
		skip: rawSkip = 0,
		getSubmissionCount,
		onlyIds,
		select: querySelectFields,
		includeLoginCount,
	} = req.query;
	const { emails, usernames, userIds, roles } = req.body;
	const isVerified =
		typeof req.body.isVerified === 'boolean'
			? req.body.isVerified
			: parseInt(req.body.isVerified, 10);
	const limit =
		typeof rawLimit !== 'string' || Number.isNaN(parseInt(rawLimit, 10))
			? 10
			: parseInt(rawLimit, 10);
	const skip =
		typeof rawSkip !== 'string' || Number.isNaN(parseInt(rawSkip, 10))
			? 10
			: parseInt(rawSkip, 10);
	const or: FilterQuery<IUser> = [];
	const searchQuery: FilterQuery<IUser> = {
		$regex: q,
		$options: 'i',
	};
	if (typeof q === 'string' && q) {
		or.push({
			email: searchQuery,
		});
		or.push({
			username: searchQuery,
		});
		or.push({
			mobileNumber: searchQuery,
		});
		or.push({
			name: searchQuery,
		});
	}
	if (typeof q === 'string') {
		const emailIdentifierSearchQuery = {
			$regex: q ? getStrippedEmail(q) : '',
			$options: 'i',
		};
		or.push({ emailIdentifier: emailIdentifierSearchQuery });
	}
	if (typeof q === 'string') {
		try {
			// eslint-disable-next-line new-cap
			const userId = Types.ObjectId(q);
			or.push({ _id: userId });
		} catch (e) {
			// its not and id
		}
	}

	const query: FilterQuery<IUser> = {
		$and: [{ $or: or }],
	};
	if (authorizationQuery) {
		query.$and.push(authorizationQuery);
	}
	const phaseQuery = {};
	if (isAccessGranted) {
		let isAccessGrantedQuery;
		if (isAccessGranted === '0') {
			isAccessGrantedQuery = false;
		} else if (isAccessGranted === '1') {
			isAccessGrantedQuery = true;
		} else if (isAccessGranted === '2') {
			isAccessGrantedQuery = { $exists: false };
		}
		const phaseMatchAsSubQuery = phases ? { phase: { $in: phases } } : {};
		phaseQuery['subscriptions.subgroups.phases'] = {
			$elemMatch: {
				isAccessGranted: isAccessGrantedQuery,
				...phaseMatchAsSubQuery,
			},
		};
		query.$and.push(phaseQuery);
	} else if (phases) {
		phaseQuery['subscriptions.subgroups.phases.phase'] = { $in: phases };
		query.$and.push(phaseQuery);
	}

	if (!isEmpty(emails)) {
		const emailQuery = {
			emailIdentifier: { $in: map(emails, getStrippedEmail) },
		};
		query.$and.push(emailQuery);
	}
	if (!isEmpty(usernames)) {
		const usernameQuery = { username: { $in: usernames } };
		query.$and.push(usernameQuery);
	}
	if (!isEmpty(userIds) && Array.isArray(userIds)) {
		const validUserIds = userIds.filter((userId) =>
			Types.ObjectId.isValid(userId)
		);
		const userIdQuery = { _id: { $in: validUserIds } };
		query.$and.push(userIdQuery);
	}
	if (!Number.isNaN(isVerified)) {
		query.$and.push({ isVerified: !!isVerified });
	}
	if (Array.isArray(roles)) {
		const allowedSearchedRoles = roles.filter((r) => isEqualOrBelow(role, r));
		if (allowedSearchedRoles.length) {
			query.$and.push({ role: { $in: allowedSearchedRoles } });
		}
	}
	let loggedInUserCount: any = null;
	if (includeLoginCount === '1') {
		const allUserIds = await UserModel.find(query).select('_id');
		loggedInUserCount = await tokenModel.aggregate([
			{
				$match: { user: { $in: allUserIds.map((u) => u._id) } },
			},
			{
				$project: {
					user: 1,
				},
			},
			{
				$group: {
					_id: '$user',
					count: { $sum: 1 },
				},
			},
			{
				$group: {
					_id: 1,
					count: { $sum: 1 },
				},
			},
		]);
	}
	UserModel.countDocuments(query, (countError: Error, count) => {
		if (countError) {
			next(new APIError('Failed to count number of results', 500));
			return;
		}
		let select: { [field: string]: number } = {
			name: 1,
			email: 1,
			mobileNumber: 1,
			username: 1,
			createdAt: 1,
			subscriptions: 1,
			isVerified: 1,
			subjects: 1,
			joiningDate: 1,
			children: 1,
			role: 1,
		};
		if (Array.isArray(querySelectFields)) {
			const allowedKeys = ['dp'];
			forEach(querySelectFields, (key: string) => {
				if (allowedKeys.indexOf(key) > -1) {
					select[key] = 1;
				}
			});
		}
		if (onlyIds) {
			select = { _id: 1 };
		}
		UserModel.find(query, select)
			.limit(limit)
			.skip(skip)
			.sort({ _id: -1 })
			.populate([
				{ path: 'subscriptions.subgroups.phases.phase', select: 'name' },
				{
					path: 'children',
					select,
					populate: { path: 'subscriptions.subgroups.phases.phase', select: 'name' },
				},
			])
			.exec(async (error, items) => {
				if (error) {
					res.status(500).send({
						message: 'Internal server error',
						error,
						skip,
						limit,
						t: typeof skip,
					});
					console.error(error);
				} else if (getSubmissionCount) {
					const submissions = await SubmissionModel.find({
						user: { $in: items.map((i) => i._id) },
					}).select('user');
					const countByUserId: { [key: string]: number } = {};
					submissions.forEach((submission) => {
						if (!countByUserId[submission.user.toString()]) {
							countByUserId[submission.user.toString()] = 0;
						}
						countByUserId[submission.user.toString()] += 1;
					});
					try {
						const itemsWithSubmissionCount = items.map((item) => ({
							...item.toObject(),
							submissionCount: countByUserId[item._id] || 0,
						}));
						res.send({
							count,
							items: itemsWithSubmissionCount,
							query,
							loggedInUserCount,
						});
					} catch (e) {
						next(new Error());
					}
				} else {
					res.send({ count, items, query, loggedInUserCount });
				}
			});
	}).catch((e) => {
		next(new APIError(e, 401));
	});
};
