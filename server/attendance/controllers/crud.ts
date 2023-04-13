import { FilterQuery } from 'mongoose';
import UserModel from '../../user/user.model';
import { getActivePhasesFromSubscriptions } from '../../utils/phase';
import { Lecture } from '../../types/Lecture';
import { parseAsInteger, parseAsString } from '../../utils/query';
import AttendanceModel from '../models/Attendance';
import LectureModel from '../models/Lecture';

var mongoose = require('mongoose');

export async function createLecture(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const { subject, phase, label, date } = req.body;
	const { id: userId } = req.payload;
	try {
		const lecture = new LectureModel({
			subject,
			phase,
			label,
			date,
			createdBy: userId,
		});
		await lecture.save();
		res.send(lecture);
	} catch (e) {
		next(e);
	}
}

export async function getLectureAttendanceSheet(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const lectureId = parseAsString(req.query.lecture);
	try {
		const items = await AttendanceModel.find({ lecture: lectureId });
		const lecture = await LectureModel.findById(lectureId);
		res.send({ items, lecture });
	} catch (e) {
		next(e);
	}
}

export async function getLectueStats(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const phaseId = parseAsString(req.query.phase);
	const subjectId = parseAsString(req.query.subject);
	const limit = parseAsInteger(req.query.limit, 10);
	const skip = parseAsInteger(req.query.skip, 0);
	const query: FilterQuery<Lecture> = {
		phase: phaseId,
		subject: subjectId,
	};
	try {
		const total = await LectureModel.countDocuments(query);
		if (!total) {
			// just saving one query
			res.send({ items: [], total: 0 });
			return;
		}
		const lectures = await LectureModel.find(query)
			.sort({ _id: -1 })
			.select('date stats label subject phase')
			.skip(skip)
			.limit(limit);
		res.send({ items: lectures, total });
	} catch (e) {
		next(e);
	}
}

export async function getUserAttendance(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const userId = parseAsString(req.params.id);
	try {
		const items = await AttendanceModel.find({ user: userId });
		// const lecture = await LectureModel.findById(lectureId);
		res.send(items);
	} catch (e) {
		next(e);
	}
}

export async function getAttendanceGraphData(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const phaseId = parseAsString(req.query.phase);
	const userId = parseAsString(req.query.user);
	const subjectId = parseAsString(req.query.subject);
	const sortBy = parseAsString(req.query.sort);
	const dateFrom = parseAsString(req.query.from);

	try {
		const lectures = await LectureModel.find({
			phase: new mongoose.Types.ObjectId(phaseId),
			subject: subjectId
				? new mongoose.Types.ObjectId(subjectId)
				: { $ne: new mongoose.Types.ObjectId(phaseId) },
			date: {
				$gte: new Date(dateFrom),
			},
		});

		const lectureArray = lectures.map(
			(lecture) => new mongoose.Types.ObjectId(lecture._id)
		);

		const graphData = await AttendanceModel.aggregate([
			{
				$match: {
					user: userId ? new mongoose.Types.ObjectId(userId) : { $ne: '' },
					$expr: {
						$in: ['$lecture', lectureArray],
					},
					// status:"P"
				},
			},
			{
				$lookup: {
					from: 'lectures', // name of mongoDB collection, NOT mongoose model
					localField: 'lecture',
					foreignField: '_id',
					as: 'lect',
				},
			},
			{
				$unwind: '$lect',
			},
			{
				$project: {
					_id: 1,
					status: 1,
					date: '$lect.date',
					month: { $month: '$lect.date' },
					week: { $week: '$lect.date' },
					day: { $dayOfMonth: '$lect.date' },
				},
			},
			{
				$facet: {
					bySort: [
						{
							$match: {
								status: 'P',
							},
						},
						{
							$group: {
								_id: `$${sortBy}`,
								count: { $sum: 1 },
								date: { $first: '$date' },
							},
						},
					],
					byStatus: [
						{
							$group: {
								_id: '$status',
								count: { $sum: 1 },
							},
						},
					],
				},
			},
		]);

		res.send(graphData);
	} catch (e) {
		next(e);
	}
}
