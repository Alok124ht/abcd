import { capitalize, forEach, isArray, toString, trim } from 'lodash';
import {
	dateToEndTime,
	dateToStartTime,
	getEndOfYear,
	getStartOfYear,
} from '../utils/date';
import { ILeaves, LeavesStatus } from '../types/Leaves';
import dayjs from 'dayjs';
import LeavesModel from './leaves.model';
import logger from '../../config/winston';
import { getClientOfUser } from '../user/utils/user';
import { isValidObjectId } from 'mongoose';
import { socket } from '../../config/config';
import UserModel from '../user/user.model';

const rolesWithPermission = ['moderator', 'admin', 'hr', 'super'];
const validRolesForLeave = (req: ExpressRequest, res: ExpressResponse) => {
	if (!rolesWithPermission.includes(req.payload.role))
		return res.send({ success: false, msg: "You don't have permission" });
};

const formatLeaves = (leaves: any[], mode: 'request' | 'grant' = 'request') => {
	const result: LeavesStatus[] = [];
	forEach(leaves, (leave) => {
		result.push({
			...leave,
			date: dateToStartTime(leave.date),
			granted: mode === 'request' ? false : true,
			rejected: false,
			type: leave.type || 'unpaid',
		});
	});
	return result;
};

const checkExistingLeave = async (
	user: string,
	date: Date | dayjs.Dayjs | string
) => {
	const formattedDate = dateToStartTime(date, 'date');
	const existing = await LeavesModel.find({
		user,
		'leavesStatus.date': formattedDate,
	});
	let result: ILeaves | boolean = false;
	if (existing) {
		forEach(existing, (leave) => {
			forEach(leave.leavesStatus, (status) => {
				if (dayjs(status.date).diff(formattedDate, 'days') === 0) {
					if (!status.granted && !status.rejected) result = leave;
					else if (status.granted) result = leave;
				}
				if (result) return result;
			});
			if (result) return result;
		});
	}
	return result;
};

export const request = async (req: ExpressRequest, res: ExpressResponse) => {
	try {
		const { id: userFromPayload, role } = req.payload;
		const { fromDate, toDate, description, leaves, byAdmin, user } = req.body;
		let days = 0;

		if (!fromDate || !toDate) {
			res.send({ success: false, msg: 'Please send proper parameters!' });
			return;
		}

		if (!leaves || !isArray(leaves) || leaves.length === 0) {
			res.send({ success: false, msg: 'Inappropriate format of leaves array' });
			return;
		}

		let userId = userFromPayload;
		if (byAdmin) {
			if (role !== 'super' && role !== 'admin' && role !== 'hr') {
				res.send({
					success: false,
					msg: "You don't have access to put employee leave",
				});
				return;
			}
			if (!user) {
				res.send({ success: false, msg: 'User is not sent!' });
				return;
			}
			userId = user;
		}

		const { client } = await getClientOfUser(userId);

		if (!client) {
			res.send({ success: false, msg: 'Unexpected client error' });
			return;
		}

		const convertedFrom = dayjs(dateToStartTime(fromDate, 'dayjs'));
		const convertedTo = dayjs(dateToStartTime(toDate, 'dayjs'));

		if (convertedFrom.toDate() === convertedTo.toDate()) days = 1;
		else days = convertedTo.diff(convertedFrom, 'days') + 1;

		const formatedLeaves = formatLeaves(leaves, byAdmin ? 'grant' : 'request');
		let exist = false;

		for (let i = 0; i < formatedLeaves.length; i++) {
			const leaves = formatedLeaves[i];
			const existing = await checkExistingLeave(userId, leaves.date);
			if (existing) {
				exist = true;
				return res.send({
					success: false,
					msg: `Leave for ${dayjs(leaves.date)
						.format('DD-MM-YYYY')
						.toString()} already exist`,
				});
			}
		}

		if (exist)
			return res.send({
				success: false,
				msg: `One of the date for leaves already exist`,
			});

		const newLeave = new LeavesModel({
			fromDate,
			toDate,
			leavesStatus: formatedLeaves,
			description,
			createdBy: byAdmin ? userFromPayload : userId,
			user: userId,
			days,
			client: client._id,
		});

		newLeave.save(async (err, saved) => {
			if (saved) {
				const user = await UserModel.find({
					'subscriptions.subgroups.phases.phase': { $in: client.phases },
					role: 'hr',
				}).select('name');
				socket.emit('leave-request', { users: user, leave: newLeave });
				res.send({
					success: true,
					msg: 'Leave request added!',
					leaveId: saved._id,
				});
			} else {
				logger.info(err.message);
				console.log(err);
				res.send({ success: false, msg: 'Error while adding leave request' });
			}
		});
	} catch (err) {
		res.send({ success: false, msg: 'Error while processing your request' });
	}
};

export const changeLeaveStatus = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id: userId } = req.payload;
		const { leaveId, date, action } = req.query;

		validRolesForLeave(req, res);
		if (!leaveId || !date || !action) {
			res.send({ success: false, msg: "Request doesn't have appropriate data" });
			return;
		}

		if (action !== 'grant' && action !== 'reject') {
			res.send({ success: false, msg: 'Action must be grant or reject' });
			return;
		}

		const convertedDate = dateToStartTime(toString(date), 'date');
		const exists = await LeavesModel.findById(toString(leaveId));
		if (exists) {
			const newLeaves: LeavesStatus[] = [];
			forEach(exists.leavesStatus, (leaves) => {
				console.log({ leavesdate: leaves.date, convertedDate });
				if (dayjs(leaves.date).diff(dayjs(convertedDate), 'days') !== 0) {
					newLeaves.push(leaves);
					console.log('i was here');
				} else
					newLeaves.push({
						date: leaves.date,
						fullDay: leaves.fullDay,
						type: leaves.type,
						granted: action === 'grant',
						rejected: action === 'reject',
						actedOn: new Date(),
						actedBy: userId,
					});
			});
			console.log(newLeaves);
			LeavesModel.updateOne(
				{ _id: leaveId },
				{ $set: { leavesStatus: newLeaves } }
			)
				.then((updated) => {
					res.send({ success: true, msg: 'Leave Status Updated!' });
				})
				.catch(() =>
					res.send({ success: false, msg: 'Leave Status not updated!' })
				);
		} else res.send({ success: false, msg: "Leave doesn't exist" });
	} catch (err) {
		res.send({ success: false, msg: 'Unexpected error occured!' });
	}
};

export const actOnSingleLeaveGroup = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { id: leaveId, action } = req.query;
	const { id: userId } = req.payload;

	validRolesForLeave(req, res);

	const oldLeave = await LeavesModel.findById(leaveId);

	if (oldLeave) {
		const newStatus: LeavesStatus[] = [];
		forEach(oldLeave.leavesStatus, (status) => {
			newStatus.push({
				date: status.date,
				fullDay: status.fullDay,
				type: status.type,
				actedBy: userId,
				actedOn: new Date(),
				granted: action === 'grant',
				rejected: action === 'reject',
			});
		});
		LeavesModel.updateOne({ _id: leaveId }, { $set: { leavesStatus: newStatus } })
			.then((updated) =>
				res.send({ success: true, msg: `All leaves ${action}ed!` })
			)
			.catch(() =>
				res.send({
					success: false,
					msg: `${capitalize(toString(action))} action failed`,
				})
			);
	} else res.send({ success: false, msg: 'Leave not found!' });
};

export const requests = async (req: ExpressRequest, res: ExpressResponse) => {
	const { id: userId } = req.payload;
	const { id: userToSearch } = req.query;
	const extraQuery: any = {};

	const { client } = await getClientOfUser(userId);
	if (!client) {
		res.send({ success: false, msg: "you don't have any client access" });
		return;
	}

	if (userToSearch && isValidObjectId(toString(userToSearch)))
		extraQuery.user = userToSearch;
	else extraQuery.client = client._id;
	LeavesModel.find({
		fromDate: { $gte: dayjs().subtract(30, 'days').toDate() },
		leavesStatus: {
			$elemMatch: {
				granted: false,
				rejected: false,
			},
		},
		...extraQuery,
	})
		.select('user leavesStatus fromDate toDate')
		.populate({
			path: 'user',
			select: 'dp username email mobileNumber name',
		})
		.then((leaves) => res.send({ success: true, leaves }))
		.catch(() =>
			res.send({ success: false, msg: 'Error while fetching requests!' })
		);
};

export const listLeaves = async (req: ExpressRequest, res: ExpressResponse) => {
	const { id: userId } = req.payload;
	const { id: userToSearch, format = 'raw', startDate, endDate } = req.query;
	const extraQuery: any = {};

	try {
		const { client } = await getClientOfUser(userId);
		if (!client)
			return res.send({ success: false, msg: "you don't have any client access" });

		let startToCheck: any =
			startDate && trim(toString(startDate)) !== ''
				? dayjs(dateToStartTime(toString(startDate))).toDate()
				: null;
		let endToCheck: any =
			endDate && trim(toString(endDate)) !== ''
				? dayjs(dateToStartTime(toString(endDate))).toDate()
				: null;

		if (!startToCheck) startToCheck = getStartOfYear('date');

		if (!endToCheck) endToCheck = getEndOfYear('date');

		if (userToSearch && isValidObjectId(toString(userToSearch)))
			extraQuery.user = userToSearch;
		else extraQuery.client = client._id;

		LeavesModel.find({
			leavesStatus: {
				$elemMatch: {
					$and: [{ date: { $gte: startToCheck } }, { date: { $lte: endToCheck } }],
				},
			},
			...extraQuery,
		})
			.select('user leavesStatus fromDate toDate')
			.populate([
				{ path: 'user', select: 'name dp email mobileNumber username joiningDate' },
				{
					path: 'leavesStatus.actedBy',
					select: 'name dp email mobileNumber username',
				},
			])
			.then((leaves) => {
				if (toString(format) === 'user') {
					const finalizedLeaves: any[] = [];

					const findElementInLeaves = (id: string) => {
						let index = -1;
						forEach(finalizedLeaves, (leaves, key) => {
							if (toString(leaves.user._id) === id) {
								index = key;
							}
							if (index !== -1) return index;
						});
						return index;
					};
					forEach(leaves, (leave) => {
						// @ts-ignore
						const exist = findElementInLeaves(toString(leave.user._id));
						if (exist === -1) {
							const leaves: any[] = [];
							forEach(leave.leavesStatus, (status) => {
								leaves.push({
									leaveId: leave._id,
									date: status.date,
									granted: status.granted,
									rejected: status.rejected,
									_id: status._id,
									type: status.type,
									fullDay: status.fullDay,
								});
							});
							finalizedLeaves.push({ user: leave.user, leaves });
						} else {
							forEach(leave.leavesStatus, (status) => {
								finalizedLeaves[exist].leaves.push({
									leaveId: leave._id,
									date: status.date,
									granted: status.granted,
									rejected: status.rejected,
									_id: status._id,
									type: status.type,
									fullDay: status.fullDay,
								});
							});
						}
					});
					res.send({ success: true, leaves: finalizedLeaves });
				} else {
					res.send({ success: true, leaves });
				}
			})
			.catch((error) => {
				res.send({ success: false, msg: 'Error while fetching leaves' });
			});
	} catch (err) {
		res.send({ success: false, msg: 'Error while calculating leaves' });
	}
};

export const upcomingLeaves = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const startDate = dateToStartTime(dayjs(), 'date');
	const endDate = dateToEndTime(dayjs().add(2, 'days'), 'date');
	const { id: userFromPayload } = req.payload;

	validRolesForLeave(req, res);

	const { client } = await getClientOfUser(userFromPayload);
	if (!client) {
		res.send({ success: false, msg: 'Client access not found' });
		return;
	}

	LeavesModel.find({
		leavesStatus: {
			$elemMatch: {
				$and: [{ date: { $gte: startDate } }, { date: { $lte: endDate } }],
				granted: true,
			},
		},
		client: client._id,
	})
		.populate([
			{
				path: 'user',
				select:
					'username email mobileNumber name subscriptions.subgroups.phases.phase',
				populate: { path: 'subscriptions.subgroups.phases.phase', select: 'name' },
			},
			{
				path: 'leavesStatus.actedBy',
				select:
					'username email mobileNumber name subscriptions.subgroups.phases.phase',
				populate: { path: 'subscriptions.subgroups.phases.phase', select: 'name' },
			},
		])
		.then((leaves) => {
			const finalLeaves: any = {};
			forEach(leaves, (leaveWrapper) => {
				forEach(leaveWrapper.leavesStatus, (status) => {
					if (status.date >= startDate && status.date <= endDate && status.granted) {
						const currentKey = dayjs(status.date).format('DD-MM-YYYY').toString();
						if (Object.keys(finalLeaves).includes(currentKey)) {
							finalLeaves[currentKey].push({
								status,
								user: leaveWrapper.user,
								leaveGroup: leaveWrapper._id,
							});
						} else {
							finalLeaves[currentKey] = [
								{ status, user: leaveWrapper.user, leaveGroup: leaveWrapper._id },
							];
						}
					}
				});
			});
			res.send({ success: true, leaves: finalLeaves });
		})
		.catch((err) =>
			res.send({ success: false, msg: 'Error while fetching leaves' })
		);
};
