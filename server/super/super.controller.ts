import { forEach, get, toLower, toString } from 'lodash';
import { isValidObjectId } from 'mongoose';
import UserModel from '../user/user.model';
import { dateToStartTime } from '../utils/date';
import ClientModel from '../client/client.model';
import { dateToEndTime } from '../utils/date';
import logger from '../../config/winston';
import tokenModel from '../token/token.model';
import submissionModel from '../assessment/submission.model';
import dayjs from 'dayjs';
import AssessmentWrapper from '../assessment/assessmentWrapper.model';
import PlaylistModel from '../learningCenter/models/Playlist';
import UserVideoStat from '../learningCenter/models/UserVideoStat';

const wrapUserQueryObject = async (req: ExpressRequest) => {
	const query: any = {};
	const { keywords, phases, clients, fromDate, tillDate, role, isArchived } =
		req.body;
	if (keywords) {
		query.$or = [
			{ name: { $regex: keywords, $options: 'i' } },
			{ username: { $regex: keywords, $options: 'i' } },
			{ email: { $regex: keywords, $options: 'i' } },
			{ mobileNumber: { $regex: keywords, $options: 'i' } },
		];
		if (isValidObjectId(keywords)) {
			query.$or.push({ _id: keywords });
		}
	}
	let localPhases: any[] = [];
	if (clients && clients.length > 0) {
		const client = await ClientModel.find({
			_id: { $in: clients },
		});
		forEach(client, (obj) => {
			forEach(obj.phases, (phase) => {
				localPhases.push(toString(phase));
			});
		});
	}
	if (phases && phases.length > 0) {
		forEach(phases, (phase) => {
			if (!localPhases.includes(phase)) localPhases.push(phase);
		});
	}
	if (localPhases.length > 0)
		if (localPhases.length === 1) {
			query['subscriptions.subgroups.phases.phase'] = localPhases[0];
		} else {
			query['subscriptions.subgroups.phases.phase'] = { $in: localPhases };
		}
	if (role && role.length > 0) {
		if (role.length === 1) query.role = role[0];
		else query.role = { $in: role };
	}
	if (fromDate || tillDate) {
		if (fromDate && tillDate) {
			if (query.$and) {
				query.$and.push({ createdAt: { $gte: dateToStartTime(fromDate) } });
				query.$and.push({ createdAt: { $lte: dateToEndTime(tillDate) } });
			} else {
				query.$and = [];
				query.$and.push({ createdAt: { $gte: dateToStartTime(fromDate) } });
				query.$and.push({ createdAt: { $lte: dateToEndTime(tillDate) } });
			}
		} else {
			if (fromDate) query.createdAt = { $gte: dateToStartTime(fromDate) };
			if (tillDate) query.createdAt = { $lte: dateToEndTime(tillDate) };
		}
	}
	if (isArchived === true) {
		query.isArchived = true;
	} else if (isArchived === false) {
		query.isArchived = { $ne: true };
	}
	return query;
};

export const getUsers = async (req: ExpressRequest, res: ExpressResponse) => {
	let { skip, limit } = req.body;
	const query = await wrapUserQueryObject(req);
	const total = await UserModel.find(query).countDocuments();
	let distinct = 0;
	await UserModel.find(query).distinct('email', (err: any, res: any) => {
		distinct = res.length;
	});
	if (!skip) skip = 0;
	if (!limit) limit = 50;
	UserModel.find(query)
		.skip(skip)
		.limit(limit)
		.sort({ createdAt: -1 })
		.populate('subscriptions.subgroups.phases.phase', 'name')
		.then((users) => {
			res.send({ success: true, users, total, distinct });
		})
		.catch((err) => {
			logger.error(err);
			res.send({ success: false, msg: 'Error while fetching user' });
		});
};

export const getLastLogin = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { user } = req.params;
		if (!user) {
			res.send({ success: false, msg: 'user is not sent' });
			return;
		}
		const lastToken = await tokenModel
			.findOne({ user })
			.sort({ createdAt: -1 })
			.select('updatedAt');
		const lastSubmission = await submissionModel
			.findOne({ user })
			.sort({ createdAt: -1 })
			.select('createdAt');

		if (!lastToken && !lastSubmission) {
			res.send({ success: false, msg: 'No login found' });
		} else if (lastToken && lastSubmission) {
			const dateToBeUsed =
				lastToken.updatedAt > lastSubmission.createdAt
					? lastToken.updatedAt
					: lastSubmission.createdAt;
			res.send({ success: true, lastLogin: dateToBeUsed });
		} else if (lastToken) {
			res.send({ success: true, lastLogin: lastToken.updatedAt });
		} else {
			res.send({ success: true, lastLogin: lastSubmission.createdAt });
		}
	} catch (err) {
		res.send({ success: false, msg: 'error' });
	}
};

export const getRecentActivities = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const query: any = {};
	let { clients, from, to } = req.body;
	const last2Month = dateToStartTime(dayjs().subtract(2, 'month'));
	const today = dateToEndTime(dayjs());
	try {
		const phases: any[] = [];
		if (!from) {
			from = last2Month;
		}
		if (!to) {
			to = today;
		}
		if (clients && clients.length > 0) {
			const client = await ClientModel.find({ _id: { $in: clients } });
			client.forEach((cl) => {
				cl.phases.forEach((phase) => {
					phases.push(phase);
				});
			});
		}
		query.$and = [];
		query.$and.push({ createdAt: { $gte: from } });
		query.$and.push({ createdAt: { $lte: to } });
		if (phases.length > 0) {
			query['subscriptions.subgroups.phases.phase'] = { $in: phases };
		}
		const usersToSearch: any[] = [];
		const users = await UserModel.find(query).select('_id');
		users.forEach((user) => {
			usersToSearch.push(user._id);
		});
		const tokens = await tokenModel
			.find({
				$and: [{ updatedAt: { $gte: from } }, { updatedAt: { $lte: to } }],
				user: { $in: usersToSearch },
			})
			.countDocuments();

		const submissions = await submissionModel
			.find({
				$and: [{ updatedAt: { $gte: from } }, { updatedAt: { $lte: to } }],
				user: { $in: usersToSearch },
			})
			.countDocuments();

		const onlySpace = /^\s*$/;
		const blankUsers = await UserModel.find({
			...query,
			$or: [
				{ name: onlySpace },
				{ username: onlySpace },
				{ email: onlySpace },
				{ mobileNumber: onlySpace },
			],
		}).countDocuments();
		res.send({
			success: true,
			data: {
				usersWithNoInfo: blankUsers,
				recentActiveUserCount: submissions + tokens,
			},
		});
	} catch (err) {
		logger.info({ err: err.message });
		res.send({ success: false, msg: 'Error while calculating' });
	}
};

const getCommonQuery = (from: Date | dayjs.Dayjs, to: Date | dayjs.Dayjs) => {
	return {
		$and: [{ createdAt: { $gte: from } }, { createdAt: { $lte: to } }],
	};
};

const formulateBody = async (req: ExpressRequest) => {
	let { clients, phases, from, to } = req.body;
	let PhasesToSearch: any[] = [];
	if (clients && clients.length > 0) {
		const client = await ClientModel.find({ _id: { $in: clients } }).select(
			'phases'
		);
		client.forEach((cl) => {
			cl.phases.forEach((phase) => {
				PhasesToSearch.push(phase);
			});
		});
	}
	if (phases && phases.length > 0) {
		PhasesToSearch = phases;
	}
	if (!from) {
		from = dayjs().subtract(1, 'month');
	}
	if (!to) {
		to = dayjs();
	}
	from = dateToStartTime(from);
	to = dateToEndTime(to);
	return {
		PhasesToSearch,
		from,
		to,
	};
};

export const getUsersCreated = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { PhasesToSearch, from, to } = await formulateBody(req);
		const commonQuery: any = getCommonQuery(from, to);
		if (PhasesToSearch.length > 0) {
			if (PhasesToSearch.length === 1)
				commonQuery['subscriptions.subgroups.phases.phase'] = PhasesToSearch[0];
			else
				commonQuery['subscriptions.subgroups.phases.phase'] = {
					$in: PhasesToSearch,
				};
		}
		const usersCreated = await UserModel.find(commonQuery).countDocuments();
		res.send({
			success: true,
			newUsers: usersCreated,
		});
	} catch (err) {
		logger.info(err.message);
		res.send({ success: false, msg: 'Error while collecting' });
	}
};

export const getWrappersCreated = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { PhasesToSearch, from, to } = await formulateBody(req);

		const commonQuery: any = getCommonQuery(from, to);
		if (PhasesToSearch.length > 0) {
			if (PhasesToSearch.length === 1) {
				commonQuery['phases.phase'] = PhasesToSearch;
			} else {
				commonQuery['phases.phase'] = { $in: PhasesToSearch };
			}
		}
		const totalWrappers = await AssessmentWrapper.find(
			commonQuery
		).countDocuments();
		res.send({
			success: true,
			totalExams: totalWrappers,
		});
	} catch (err) {
		logger.info(err.message);
		res.send({ success: false, msg: 'Error while collecting' });
	}
};

export const getTotalSubmissions = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { PhasesToSearch, from, to } = await formulateBody(req);
		const commonQuery: any = getCommonQuery(from, to);
		const users = await UserModel.find(
			PhasesToSearch.length > 0
				? PhasesToSearch.length === 1
					? { 'subscriptions.subgroups.phases.phase': PhasesToSearch[0] }
					: { 'subscriptions.subgroups.phases.phase': { $in: PhasesToSearch } }
				: {}
		).select('_id');
		const usersToSearch: any[] = [];
		users.forEach((user) => {
			usersToSearch.push(toString(user._id));
		});
		const totalSubmissions = await submissionModel
			.find({
				user: { $in: usersToSearch },
				...commonQuery,
			})
			.countDocuments();
		res.send({
			success: true,
			totalSubmissions,
		});
	} catch (err) {
		logger.info(err.message);
		res.send({ success: false, msg: 'Error while collecting' });
	}
};

export const getLearningCenterDetails = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { PhasesToSearch, from, to } = await formulateBody(req);
		const commonQuery: any = getCommonQuery(from, to);
		if (PhasesToSearch.length > 0) {
			commonQuery['accessibleTo.type'] = 'Phase';
			if (PhasesToSearch.length === 1)
				commonQuery['accessibleTo.value'] = PhasesToSearch[0];
			else commonQuery['accessibleTo.value'] = { $in: PhasesToSearch };
		}
		const playlist = await PlaylistModel.find(commonQuery).select(
			'items resourceType'
		);
		let totalItems: { assignment: number; document: number; video: number } = {
			assignment: 0,
			document: 0,
			video: 0,
		};
		playlist.forEach((pl) => {
			if (toLower(pl.resourceType) === 'video') {
				totalItems.video += pl.items.length;
			} else if (toLower(pl.resourceType) === 'assignment') {
				totalItems.assignment += pl.items.length;
			} else {
				totalItems.document += pl.items.length;
			}
		});
		res.send({
			success: true,
			totalPlaylists: playlist.length,
			totalItems,
		});
	} catch (err) {
		logger.info(err.message);
		res.send({ success: false, msg: 'Error while collecting' });
	}
};

export const getAverageTimeSpentOnPortal = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { phase, from, to } = req.body;

		const wrappers = await AssessmentWrapper.find({ 'phases.phase': phase })
			.select('name core')
			.populate([
				{ path: 'core', select: 'duration' },
				{ path: 'analysis', select: 'submissions' },
			]);

		let totalWrapperDuration = 0;

		forEach(wrappers, (wrapper) => {
			const submissions = get(wrapper, 'analysis.submissions', []);
			totalWrapperDuration +=
				submissions.length * get(wrapper, 'core.duration', 3600);
		});

		const playlists = await PlaylistModel.find({
			'accessibleTo.type': 'Phase',
			'accessibleTo.value': phase,
		}).select('title items resourceType');

		const videos: any[] = [],
			assignments: any[] = [],
			documents: any[] = [];

		forEach(playlists, (playlist) => {
			if (playlist.resourceType === 'Video') {
				videos.push(...playlist.items);
			} else if (playlist.resourceType === 'Assignment') {
				assignments.push(...playlist.items);
			} else {
				documents.push(...playlist.items);
			}
		});

		const fetchedVideos = await UserVideoStat.find({ v: { $in: videos } }).select(
			'wt'
		);

		let videoWatchTime = 0;

		forEach(fetchedVideos, (videos) => {
			videoWatchTime += get(videos, 'wt', 0); // it's in milliseconds
		});
		videoWatchTime = videoWatchTime / 1000;

		const assignmentWatchTime = assignments.length * 30 * 60; // 30 mins for Each Assignment

		const documentsWatchTime = documents.length * 30 * 60; // 30 mins for Each Document

		const userCount = await UserModel.find({
			'subscriptions.subgroups.phases.phase': phase,
		}).countDocuments();

		res.send({
			success: true,
			videoWatchTime,
			assignmentWatchTime,
			documentsWatchTime,
			totalWrapperDuration,
			userCount,
		});
	} catch (err) {
		res.send({ success: false, msg: 'Error while calculating data' });
	}
};
