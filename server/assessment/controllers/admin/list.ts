import AssessmentCore from '../../assessmentCore.model';
import { UserRole } from '../../../user/IUser';
import { isAtLeast } from '../../../utils/user/role';
import { parseAsInteger, parseAsStringArray } from '../../../utils/query';
import ClientModel from '../../../client/client.model';
import AssessmentWrapper from '../../../assessment/assessmentWrapper.model';
import APIError from '../../../helpers/APIError';
import { projectionWithContentWithoutAnswers } from '../../../question/constants';
import { filter, forEach, get, isArray, trim } from 'lodash';
import logger from '../../../../config/winston';
import UserModel from '../../../user/user.model';
import dayjs from 'dayjs';
import { dateToStartTime, dateToEndTime } from '../../../utils/date';
import { isValidObjectId } from 'mongoose';
import { ObjectId } from 'mongodb';

export async function listCoresAdmin(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const {
		payload: { role, id },
	} = req;
	const { superGroup } = req.params;
	const limit = parseAsInteger(req.query.limit, 100);
	const phases = parseAsStringArray(req.query.phases);
	const hasSearchedByPhase = !!phases.length;

	if (isAtLeast(UserRole.ADMIN, role)) {
		if (hasSearchedByPhase) {
			try {
				const cores = await AssessmentCore.getByPhaseIdsOrClient(
					superGroup,
					phases,
					null,
					limit
				);
				res.send({ cores, success: true, hasSearchedByPhase });
			} catch (e) {
				res
					.status(422)
					.send({ success: false, message: 'Failed to search by phase for admin' });
			}
		} else {
			await AssessmentCore.get(superGroup, limit)
				.then((cores) => {
					res.json({ success: true, cores });
				})
				.catch(() => {
					res.status(422).json({ success: false });
				});
		}
	} else {
		ClientModel.findOne({ moderators: id }, { _id: 1, phases: 1 })
			.then((client) => {
				const phaseIds = !hasSearchedByPhase
					? client.phases
					: filter(client.phases, (phase) => phases.includes(phase.toString()));
				AssessmentCore.getByPhaseIdsOrClient(
					superGroup,
					phaseIds,
					hasSearchedByPhase ? null : client._id,
					limit
				).then((cores) => {
					res.json({
						success: true,
						cores,
						forPhases: phaseIds,
						hasSearchedByPhase,
					});
				});
			})
			.catch((error) => {
				next(error);
			});
	}
}
export const listCoresAdmin2 = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { role, id: userId } = req.payload;
		let { keywords, phases, skip, limit, sort, startDate, endDate } = req.body;
		let convertedStartDate = null;
		let convertedEndDate = null;
		let clientToFind = null;
		if (startDate) {
			convertedStartDate = dayjs(startDate).toDate();
		}
		if (endDate) {
			convertedEndDate = dayjs(endDate).toDate();
		}
		let wrapperQuery: any = {};
		let coreQuery: any = {};
		if (!skip) {
			skip = 0;
		}
		if (!limit) {
			limit = 50;
		}
		if (!sort) {
			sort = -1;
		}
		if (role === 'user' || role === 'parent') {
			res.send({ success: false, msg: "You don't have permission" });
			return;
		}
		if (keywords || trim(keywords) !== '') {
			wrapperQuery.name = { $regex: keywords, $options: 'i' };
			coreQuery.identifier = { $regex: keywords, $options: 'i' };
		}
		if (
			(!phases || phases.length === 0) &&
			role !== UserRole.SUPER &&
			role !== UserRole.ADMIN
		) {
			phases = [];
			logger.info('No phases section');
			const dbUser = await UserModel.findById(userId).select('subscriptions');
			dbUser.subscriptions.forEach((subs) => {
				subs.subgroups.forEach((sub) => {
					sub.phases.forEach((phase) => {
						phases.push(phase.phase);
					});
				});
			});
			if (role === 'moderator') {
				const client = await ClientModel.findOne({
					moderators: userId,
				});
				phases = client.phases.filter((phase) => phase);
				clientToFind = client._id;
			}
			wrapperQuery['phases.phase'] = { $in: phases };
		} else {
			if (phases && phases.length > 0)
				wrapperQuery['phases.phase'] = { $in: phases };
		}
		if (!keywords && !phases && (convertedStartDate || convertedEndDate)) {
			wrapperQuery.$and = [];
			coreQuery.$and = [];
			if (convertedStartDate) {
				wrapperQuery.$and.push({ availableFrom: { $gte: convertedStartDate } });
			}
			if (convertedEndDate) {
				wrapperQuery.$and.push({ availableFrom: { $lte: convertedEndDate } });
			}
		}
		coreQuery.isArchived = false;
		if (role !== UserRole.ADMIN && role !== UserRole.SUPER) {
			const wrappers = await AssessmentWrapper.find(wrapperQuery)
				.select('_id')
				.sort({ createdAt: -1 })
				.populate({
					path: 'core',
				});
			const ids: any[] = [];
			wrappers.forEach((wrapper) => {
				ids.push(wrapper.id);
			});
			logger.info('Wrappers loaded');

			if (ids.length === 0) {
				res.send({
					success: false,
					msg: 'No wrappers found for selected criteria',
				});
				return;
			}

			const count = await AssessmentCore.find(
				!clientToFind
					? {
							...coreQuery,
							'wrappers.wrapper': { $in: ids },
							isArchived: false,
					  }
					: {
							$or: [
								{
									...coreQuery,
									'wrappers.wrapper': { $in: ids },
									isArchived: false,
								},
								{ client: clientToFind },
							],
					  }
			).countDocuments();

			AssessmentCore.find(
				!clientToFind
					? {
							...coreQuery,
							'wrappers.wrapper': { $in: ids },
							isArchived: false,
					  }
					: {
							$or: [
								{
									...coreQuery,
									'wrappers.wrapper': { $in: ids },
									isArchived: false,
								},
								{ client: clientToFind },
							],
					  }
			)
				.populate([
					{
						path: 'wrappers.wrapper',
						populate: 'phases.phase',
					},
					{
						path: 'analysis',
					},
				])
				.skip(skip)
				.limit(limit)
				.sort({ createdAt: -1 })
				.then((cores) => res.send({ cores, count, success: true }));
		} else {
			const tempQuery: any = {};
			if (
				(!keywords || trim(keywords) === '') &&
				(!phases || (phases && phases.length === 0)) &&
				(convertedStartDate || convertedEndDate)
			) {
				tempQuery.$and = [];
				if (convertedStartDate) {
					tempQuery.$and.push({ createdAt: { $gte: convertedStartDate } });
				}
				if (convertedEndDate) {
					tempQuery.$and.push({ createdAt: { $lte: convertedEndDate } });
				}
			}
			if (keywords && trim(keywords) !== '') {
				tempQuery.identifier = { $regex: keywords, $options: 'i' };
			}
			tempQuery.isArchived = false;
			const count = await AssessmentCore.find(tempQuery).countDocuments();

			AssessmentCore.find(tempQuery)
				.populate([
					{
						path: 'wrappers.wrapper',
						populate: 'phases.phase',
					},
					{
						path: 'analysis',
					},
				])
				.skip(skip)
				.limit(limit)
				.sort({ createdAt: -1 })
				.then((cores) => res.send({ cores, count, success: true }));
		}
	} catch (err) {
		res.send({ success: false, msg: 'Error while loading' });
	}
};

export const listWrappersAdmin = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { role, id: userId } = req.payload;
	let { keywords, phases, startDate, endDate, skip, limit } = req.body;
	const query: any = {};
	if (keywords && trim(keywords) !== '') {
		query.$or = [];
		query.$or.push({ name: { $regex: keywords, $options: 'i' } });
		if (isValidObjectId(trim(keywords))) {
			logger.info('valid object id');
			query.$or.push({ _id: new ObjectId(trim(keywords)) });
		}
	}
	if (phases && isArray(phases) && phases.length !== 0) {
		query['phases.phase'] = { $in: phases };
	} else {
		if (role !== 'admin' && role !== 'super') {
			if (role === 'moderator') {
				const client = await ClientModel.findOne({
					moderators: userId,
				});
				const phases: any[] = [];
				forEach(client.phases, (phase) => {
					phases.push(phase);
				});
				query['phases.phase'] = { $in: phases };
			} else if (role === 'teacher') {
				const user = await UserModel.findById(userId);
				const phase = get(
					user,
					'subscriptions[0].subgroups[0].phases[0].phase',
					null
				);
				if (phase) query['phases.phase'] = phase;
			}
		}
	}
	if (startDate) {
		startDate = dateToStartTime(startDate);
		query.availableFrom = { $gte: startDate };
	}
	if (endDate) {
		endDate = dateToEndTime(endDate);
		query.availableTill = { $lte: endDate };
	}
	if (!skip) {
		skip = 0;
	}
	if (!limit) {
		limit = 20;
	}
	if (role !== 'admin' && role !== 'super') {
		query.isArchived = false;
	}
	const count = await AssessmentWrapper.find(query).countDocuments();

	AssessmentWrapper.find(query)
		.populate([
			{
				path: 'phases.phase',
				select: 'name',
			},
			{
				path: 'core',
				select: 'duration identifier createdAt analysis',
				populate: {
					path: 'analysis',
					select: 'maxMarks',
				},
			},
			{
				path: 'analysis',
				select: 'name totalAttempts liveAttempts',
			},
		])
		.skip(skip)
		.limit(limit)
		.sort({ createdAt: -1 })
		.then((wrappers) => {
			res.send({ success: true, wrappers, total: count });
		})
		.catch((err) => {
			res.send({
				success: false,
				msg: 'Error while fetching wrappers',
			});
		});
};

export const getSingleCore = (req: ExpressRequest, res: ExpressResponse) => {
	const { id } = req.params;
	AssessmentCore.findById(id)
		.populate({
			path: 'wrappers.wrapper',
			populate: 'phases.phase',
		})
		.then((core) => {
			if (core) {
				res.send({ success: true, core });
			} else {
				res.send({ success: false, msg: "Can't find core" });
			}
		})
		.catch((err) => {
			res.send({ success: false, msg: 'Error while fetching core' });
		});
};

export async function getWrapper(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const { role } = req.payload;
	const {
		adminPermission: { phases },
	} = res.locals;
	const { wrapperId } = req.params;
	const populate = [];
	const includeCore = parseAsInteger(req.query.core, 0) === 1;
	if (includeCore) {
		populate.push({
			path: 'core',
			populate: {
				path: 'sections.questions.question',
				select: projectionWithContentWithoutAnswers,
			},
		});
	}

	const wrapper = await AssessmentWrapper.findById(wrapperId).populate(populate);
	const hasAccess =
		isAtLeast(UserRole.ADMIN, role) ||
		wrapper.phases.some((phase) => phases.some((p) => p.equals(phase.phase)));
	if (!hasAccess) {
		next(new APIError('You do not have access to this wrapper'));
	} else {
		res.send(wrapper);
	}
}
