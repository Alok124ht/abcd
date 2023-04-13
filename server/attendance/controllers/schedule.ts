import { FilterQuery, Types } from 'mongoose';
import { map, omit } from 'lodash';
import { parseAsString, parseAsStringArray } from '../../utils/query';
import ScheduledLectureModel from '../models/ScheduledLecture';
import { ScheduledLecture } from 'server/types/ScheduledLecture';
import moment from 'moment';

export async function createScheduledLectures(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const { id: userId } = req.payload;
	const {
		items: rawItems,
	}: {
		items: {
			phases: string[];
			subject: string;
			startTime: string;
			endTime: string;
			lecturer: string;
		}[];
	} = req.body;
	const items = map(rawItems, (item) => {
		return {
			...item,
			phases: map(item.phases, (phaseId) => Types.ObjectId(phaseId)),
			createdBy: userId,
		};
	});
	try {
		const createdItems = await ScheduledLectureModel.create(...items);
		res.send(createdItems);
	} catch (e) {
		next(e);
	}
}

export async function createScheduledLecture(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const { id: userId } = req.payload;
	const rawItem: {
		phases: string[];
		subject: string;
		startTime: string;
		endTime: string;
		lecturer: string;
	} = req.body;
	const item = {
		...rawItem,
		phases: map(rawItem.phases, (phaseId) => Types.ObjectId(phaseId)),
		createdBy: userId,
	};
	try {
		const createdItems = await ScheduledLectureModel.create(item);
		res.send(createdItems);
	} catch (e) {
		next(e);
	}
}

export async function listScheduledLectures(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const phases = parseAsStringArray(req.query.phases).map((phase) =>
		Types.ObjectId(phase)
	);
	const subjects = parseAsStringArray(req.query.subjects);
	const query: FilterQuery<ScheduledLecture> = { phases };
	if (Array.isArray(subjects) && subjects.length) {
		query.subject = { $in: subjects };
	}
	const items = await ScheduledLectureModel.find(query).populate([
		{
			path: 'lecturer',
			select: 'name dp',
		},
	]);
	res.send({ items });
}

export async function listScheduledLecturesByLecturer(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const lecturer = parseAsString(req.query.lecturer);
	const query: FilterQuery<ScheduledLecture> = { lecturer };
	const items = await ScheduledLectureModel.find(query).populate([
		{
			path: 'lecturer',
			select: 'name dp',
		},
	]);
	res.send({ items });
}

export async function getScheduledLecture(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	try {
		const { id: scheduledLectureId } = req.params;
		const scheduledLecture = await ScheduledLectureModel.findById(
			scheduledLectureId
		);
		res.send(scheduledLecture);
	} catch (e) {
		next();
	}
}

export async function updateScheduledLecture(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	try {
		const { id: scheduledLectureId } = req.params;
		const { phases, subject, startTime, endTime, lecturer } = req.body;
		const sLecture = await ScheduledLectureModel.findById(scheduledLectureId);
		sLecture.phases = phases;
		sLecture.subject = subject;
		sLecture.startTime = startTime;
		sLecture.endTime = endTime;
		sLecture.lecturer = lecturer;
		await sLecture.save();
		res.send(sLecture);
	} catch (e) {
		console.log(req.body);
		next(e);
	}
}

export async function copy(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const {
		fromTime,
		tillTime,
		fromPhases,
		forSubjects,
		usePreviousPhases,
		phasesToSet,
		addDuration,
		durationUnit,
	} = req.body;

	const query: FilterQuery<ScheduledLecture> = { phases: fromPhases };
	if (Array.isArray(forSubjects) && forSubjects.length) {
		query.subject = {
			$in: forSubjects,
		};
	}
	query.startTime = {
		$gte: fromTime,
		$lte: tillTime,
	};
	try {
		const lecturesToCopy = await ScheduledLectureModel.find(query);
		const newItems = lecturesToCopy.map(
			(lecture) =>
				new ScheduledLectureModel({
					...omit(lecture.toObject(), '_id'),
					startTime: moment(lecture.startTime).add(addDuration, durationUnit),
					endTime: moment(lecture.endTime).add(addDuration, durationUnit),
					phases: usePreviousPhases ? lecture.phases : phasesToSet,
				})
		);
		await ScheduledLectureModel.create(...newItems);
		res.send({ items: lecturesToCopy });
	} catch (e) {
		next(e);
	}
}
