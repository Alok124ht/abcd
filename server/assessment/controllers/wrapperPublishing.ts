import { Types } from 'mongoose';
import { NextFunction, Response } from 'express';
import { includes, isEmpty, map } from 'lodash';
import { Request } from '../../types/Request';
import APIError from '../../helpers/APIError';
import AssessmentCore from '../assessmentCore.model';
import AssessmentWrapper from '../assessmentWrapper.model';
import WrapperAnalysis from '../wrapperAnalysis.model';
import Phase from '../../phase/phase.model';
import { clearPhaseWrapperCache } from '../utils/cache';
import AssessmentWrapperCache from '../../cache/AssessmentWrapper';
import { PublishedInPhaseDetail } from 'server/types/AssessmentWrapper';
import { TagList } from 'server/types/Tag';
import GradeTimeModel from '../gradeTime.model';

export function addPhase(req: Request, res: Response) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}
	const { wrapperId, name, phase, availableFrom } = req.body;

	AssessmentWrapper.findById(wrapperId, { phases: 1 })
		.then((assessmentWrapper) => {
			if (assessmentWrapper) {
				Phase.findById(phase, { _id: 1 })
					.then((ph) => {
						if (ph) {
							let found = false;
							assessmentWrapper.phases.forEach((pha) => {
								if (pha.phase.equals(phase)) {
									pha.name = name;
									if (availableFrom) pha.availableFrom = availableFrom;
									found = true;
								}
							});
							if (!found) {
								const data: PublishedInPhaseDetail = {
									phase: Types.ObjectId(phase),
									name,
								};
								if (availableFrom) {
									data.availableFrom = availableFrom;
								}
								assessmentWrapper.phases.push(data);
							}
							assessmentWrapper.markModified('phases');
							assessmentWrapper.save().then(() => {
								res.json({ success: true });
								clearPhaseWrapperCache([phase]);
								AssessmentWrapperCache.clear(assessmentWrapper._id, () => {});
							});
						} else {
							res.json({ success: false });
						}
					})
					.catch(() => {
						res.json({ success: false });
					});
			} else {
				res.json({ success: false });
			}
		})
		.catch(() => {
			res.json({ success: false });
		});
}
export function removePhase(req: Request, res: Response, next: NextFunction) {
	const { wrapperId, phase } = req.body;
	const { phases } = res.locals;
	if (!includes(phases, phase)) {
		next(new APIError('Not allowed', 403, true));
	}

	AssessmentWrapper.update({ _id: wrapperId }, { $pull: { phases: { phase } } })
		.then((m) => {
			if (m.nModified === 1) {
				res.json({ success: true, m });
			} else {
				res.json({ success: false, m });
			}
		})
		.catch(() => {
			res.json({ success: false });
		});
}

export function addWrapper(
	req: Request & {
		body: {
			phases: string[];
			tags: TagList;
		};
	},
	res: Response
) {
	const {
		id,
		name,
		type,
		topic,
		section,
		availableFrom,
		availableTill,
		visibleFrom,
		expiresOn,
		cost,
		reward,
		label,
		series,
		phases,
		tags,
		onlyCBT,
	} = req.body;

	if (!name) {
		res.json({ success: false, c: 1 });
	} else if (!type) {
		// should be one out of...
		res.json({ success: false, c: 2 });
	} else if (type === 'TOPIC-MOCK' && !topic) {
		res.json({ success: false, c: 3 });
	} else if (type === 'SECTIONAL-MOCK' && !section) {
		res.json({ success: false, c: 4 });
	} else if (!availableFrom || !availableTill || !visibleFrom) {
		res.json({ success: false, c: 5 });
	} else if (isEmpty(phases)) {
		res.json({ success: false, c: 6 });
	} else {
		Phase.find({ _id: { $in: phases } }, { supergroup: 1 }).then((phs) => {
			if (phs.length !== phases.length) {
				res.json({ success: false, c: 7 });
			} else {
				let supergroup = '';
				let errorFound = false;
				phs.forEach((ph) => {
					if (!supergroup) supergroup = ph.supergroup.toString();
					if (!ph.supergroup || ph.supergroup.toString() !== supergroup) {
						errorFound = true;
					}
				});

				if (errorFound) {
					res.json({ success: false, c: 8 });
				} else {
					AssessmentCore.findById(id).then((core) => {
						if (core) {
							const wrapperAnalysis = new WrapperAnalysis({
								core: core._id,
								bonus: {},
								marks: [],
								hist: [0, 0, 0, 0, 0, 0],
								topper: {},
								sections: core.sections.map((section) => ({
									id: section._id,
									marks: [],
									hist: [0, 0, 0, 0, 0, 0],
								})),
								difficulty: {
									easy: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0 },
									medium: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0 },
									hard: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0 },
								},
							});

							wrapperAnalysis.save().then((savedWrapperAnalysis) => {
								const assessmentWrapper = new AssessmentWrapper({
									core: core._id,
									name,
									type,
									availableFrom,
									availableTill,
									visibleFrom,
									expiresOn,
									cost,
									reward,
									topic: type === 'TOPIC-MOCK' ? topic : '',
									section: type === 'SECTIONAL-MOCK' ? section : '',
									label,
									series,
									phases: map(phases, (phase) => ({ phase })),
									analysis: savedWrapperAnalysis._id,
									tags,
									onlyCBT,
								});
								assessmentWrapper.save().then(async (savedWrapper) => {
									const newGradeTime = new GradeTimeModel({
										wrapper: savedWrapper._id,
										time: availableTill,
										graded: false,
									});
									await newGradeTime.save();
									core.wrappers.push({ wrapper: savedWrapper._id });
									core.markModified('wrappers');
									core.save().then(() => {
										clearPhaseWrapperCache(phases);
										AssessmentCore.get(core.supergroup).then((cores) => {
											res.json({ success: true, cores });
										});
									});
								});
							});
						} else {
							res.json({ success: false });
						}
					});
				}
			}
		});
	}
}

export const updateOnlyCBT = (req: ExpressRequest, res: ExpressResponse) => {
	const { _id, onlyCBT } = req.body;

	let status = true;

	if (!onlyCBT || onlyCBT === 'no') {
		status = false;
	}

	AssessmentWrapper.updateOne(
		{
			_id,
		},
		{
			$set: {
				onlyCBT: status,
			},
		}
	)
		.then((updated) => res.send({ success: true }))
		.catch((err) =>
			res.send({ success: false, msg: 'Error while updating Only CBT option' })
		);
};
