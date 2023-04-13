import { Types } from 'mongoose';
import { concat, get, has } from 'lodash';
import SubGroupModel from '../../../group/subGroup.model';
import SuperGroupModel from '../../../group/superGroup.model';
import ClientModel from '../../../client/client.model';
import PhaseModel from '../../../phase/phase.model';
import { UserRole } from '../../../user/IUser';
import { isEqualOrBelow } from '../../../utils/user/role';
import { clearFromCache } from '../../../cache/Phase';
import { SubGroup } from '../../../types/SubGroup';
import UserModel from '../../../user/user.model';
import APIError from '../../../helpers/APIError';

export async function getPhases(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const {
		payload: { role, id },
	} = req;
	const { adminPermission } = res.locals;
	if (role === UserRole.MODERATOR) {
		try {
			const client = await ClientModel.findOne({ moderators: id }, { phases: 1 });
			const allPhasesIds = concat(client.phases, adminPermission.phases);
			const phases = await PhaseModel.find({ _id: { $in: allPhasesIds } });
			res.json({ success: true, phases });
		} catch (e) {
			next(e);
		}
	} else if (isEqualOrBelow(UserRole.MENTOR, role)) {
		const phases = await PhaseModel.find({
			_id: { $in: adminPermission.phases },
		});
		res.send({ phases, success: true });
	} else if (role === UserRole.ACCOUNT_STAFF) {
		UserModel.findById(id)
			.then((user) => {
				const phase = get(user, 'subscrptions[0].subgroups[0].phases[0].phase');
				if (!phase) {
					next(new APIError('Phase not found!'));
				} else {
					ClientModel.findOne({ phases: phase })
						.then((cli) => {
							if (!cli) {
								next(new APIError('Client not found!'));
							} else {
								PhaseModel.find({ _id: { $in: cli.phases } })
									.then((phases) => {
										res.send({ phases, success: true });
									})
									.catch((err) => {
										next(err);
									});
							}
						})
						.catch((err) => {
							next(err);
						});
				}
			})
			.catch((err) => {
				next(err);
			});
	} else {
		const phases = await PhaseModel.find();
		res.json({ success: true, phases });
	}
}

function updateSubgroups(
	subgroups: SubGroup[],
	finalSubgroups: { [subGroupId: string]: boolean },
	phaseId: Types.ObjectId,
	phaseName: string
) {
	const totalSubgroups = Object.keys(finalSubgroups).length;

	subgroups.forEach((sg) => {
		if (finalSubgroups[sg._id.toString()]) {
			SubGroupModel.update(
				{ _id: sg._id },
				{ $pull: { phases: { phase: phaseId } } }
			).then(() => {
				if (totalSubgroups === 1 && phaseName) {
					SubGroupModel.update(
						{ _id: sg._id },
						{ $push: { phases: { phase: phaseId } }, $set: { name: phaseName } }
					).exec();
				} else {
					SubGroupModel.update(
						{ _id: sg._id },
						{ $push: { phases: { phase: phaseId } } }
					).exec();
				}
			});
		} else {
			SubGroupModel.update(
				{ _id: sg._id },
				{ $pull: { phases: { phase: phaseId } } }
			).exec();
		}
	});
}

export async function updatePhase(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const {
		payload: { role, id },
	} = req;

	const { phase } = req.body;

	if (role === 'moderator') {
		ClientModel.find({ moderators: id, phases: phase._id }).then((client) => {
			if (client) {
				PhaseModel.findOne({ _id: phase._id }).then((ph) => {
					if (ph) {
						SuperGroupModel.get(ph.supergroup, { subgroups: 1 }).then(
							(supergroup) => {
								if (supergroup && phase.subgroups) {
									const availableSubgroups: { [subGroupId: string]: boolean } = {};
									supergroup.subgroups.forEach((sg) => {
										availableSubgroups[sg.subgroup.toString()] = true;
									});
									let errorFound = false;
									const finalSubgroups: { [subGroupId: string]: boolean } = {};
									phase.subgroups.forEach((sg) => {
										if (!availableSubgroups[sg.subgroup]) errorFound = true;
										finalSubgroups[sg.subgroup] = true;
									});
									if (!errorFound) {
										SubGroupModel.find(
											{ supergroup: supergroup._id },
											{ phases: 1, name: 1 }
										).then((subgroups) => {
											let newSubgroupName = '';

											if (subgroups.length === 1 && subgroups[0].name === ph.name) {
												newSubgroupName = phase.name ? phase.name : ph.name;
											}
											updateSubgroups(subgroups, finalSubgroups, ph._id, newSubgroupName);

											ph.name = phase.name ? phase.name : ph.name;
											ph.startDate = phase.startDate ? phase.startDate : ph.startDate;
											ph.endDate = phase.endDate ? phase.endDate : ph.endDate;
											ph.hasCoursePlan =
												typeof phase.hasCoursePlan !== 'undefined'
													? phase.hasCoursePlan
													: ph.hasCoursePlan;
											ph.inferCoursePlan =
												typeof phase.inferCoursePlan !== 'undefined'
													? phase.inferCoursePlan
													: ph.inferCoursePlan;
											ph.externalScheduleLink =
												typeof phase.externalScheduleLink !== 'undefined'
													? phase.externalScheduleLink
													: ph.externalScheduleLink;
											ph.subgroups = phase.subgroups;
											ph.liveTests = phase.liveTests;
											ph.fullMocks = phase.fullMocks;
											ph.sectionalMocks = phase.sectionalMocks;
											ph.topicMocks = phase.topicMocks;
											ph.topics = phase.topics;
											ph.enrollmentEndDate = phase.enrollmentEndDate;
											ph.enrollmentStartDate = phase.enrollmentStartDate;
											ph.subjects = phase.subjects;
											ph.config = phase.config;
											if (has(phase, 'group')) {
												ph.group = phase.group;
											}
											if (has(phase, 'isPrivate')) {
												ph.set('isPrivate', phase.isPrivate);
											}
											if (has(phase, 'deviceLimit')) {
												const deviceLimit =
													typeof phase.deviceLimit === 'string'
														? parseInt(phase.deviceLimit, 10)
														: phase.deviceLimit;
												if (Number.isNaN(deviceLimit)) {
													ph.set('deviceLimit', undefined);
												} else {
													ph.set('deviceLimit', deviceLimit);
												}
											}
											ph.markModified('name');
											ph.markModified('startDate');
											ph.markModified('endDate');
											ph.markModified('fee');
											ph.markModified('hasCoursePlan');
											ph.markModified('subgroups');
											ph.markModified('topics');
											ph.save().then(() => {
												clearFromCache(phase._id);
												res.json({ success: true, phase: ph });
											});
										});
									} else {
										res.json({
											success: false,
											error: { code: 'supergroup-subgroup-mismatch' },
										});
									}
								} else {
									res.json({ success: false });
								}
							}
						);
					} else {
						res.json({ success: false });
					}
				});
			} else {
				res.json({ success: false });
			}
		});
	} else {
		PhaseModel.findOne({ _id: phase._id }).then((ph) => {
			if (ph) {
				SuperGroupModel.get(ph.supergroup, { subgroups: 1 }).then((supergroup) => {
					if (supergroup && phase.subgroups) {
						const availableSubgroups: { [subGroupId: string]: boolean } = {};
						supergroup.subgroups.forEach((sg) => {
							availableSubgroups[sg.subgroup.toString()] = true;
						});
						let errorFound = false;
						const finalSubgroups: { [subGroupId: string]: boolean } = {};
						phase.subgroups.forEach((sg) => {
							if (!availableSubgroups[sg.subgroup]) errorFound = true;
							finalSubgroups[sg.subgroup] = true;
						});
						if (!errorFound) {
							SubGroupModel.find({ supergroup: supergroup._id }, { phases: 1 }).then(
								(subgroups) => {
									updateSubgroups(subgroups, finalSubgroups, ph._id, '');

									ph.name = phase.name ? phase.name : ph.name;
									ph.startDate = phase.startDate ? phase.startDate : ph.startDate;
									ph.endDate = phase.endDate ? phase.endDate : ph.endDate;
									ph.hasCoursePlan =
										typeof phase.hasCoursePlan !== 'undefined'
											? phase.hasCoursePlan
											: ph.hasCoursePlan;
									ph.inferCoursePlan =
										typeof phase.inferCoursePlan !== 'undefined'
											? phase.inferCoursePlan
											: ph.inferCoursePlan;
									ph.externalScheduleLink =
										typeof phase.externalScheduleLink !== 'undefined'
											? phase.externalScheduleLink
											: ph.externalScheduleLink;
									ph.subgroups = phase.subgroups;
									ph.liveTests = phase.liveTests;
									ph.fullMocks = phase.fullMocks;
									ph.sectionalMocks = phase.sectionalMocks;
									ph.topicMocks = phase.topicMocks;
									ph.topics = phase.topics;
									ph.enrollmentStartDate = phase.enrollmentStartDate;
									ph.enrollmentEndDate = phase.enrollmentEndDate;
									ph.subjects = phase.subjects;
									ph.config = phase.config;
									if (has(phase, 'group')) {
										ph.group = phase.group;
									}
									if (has(phase, 'isPrivate')) {
										ph.set('isPrivate', phase.isPrivate);
									}
									if (has(phase, 'deviceLimit')) {
										const deviceLimit = parseInt(phase.deviceLimit, 10);
										if (Number.isNaN(deviceLimit)) {
											ph.set('deviceLimit', undefined);
										} else {
											ph.set('deviceLimit', deviceLimit);
										}
									}
									ph.markModified('name');
									ph.markModified('startDate');
									ph.markModified('endDate');
									ph.markModified('fee');
									ph.markModified('hasCoursePlan');
									ph.markModified('subgroups');
									ph.markModified('topics');
									ph.save().then(() => {
										clearFromCache(ph._id);
										res.json({ success: true, phase: ph });
									});
								}
							);
						} else {
							res.json({
								success: false,
								error: { code: 'supergroup-subgroup-mismatch' },
							});
						}
					} else {
						res.json({ success: false });
					}
				});
			} else {
				res.json({ success: false });
			}
		});
	}
}
