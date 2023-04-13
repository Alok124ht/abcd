/**
 * This file contains function to download data for admin related to user
 */

import { NextFunction, Response } from 'express';
import Papa from 'papaparse';
import { get, forEach } from 'lodash';
import moment, { MomentInput } from 'moment';
import SubGroupModel from '../../group/subGroup.model';
import SuperGroupModel from '../../group/superGroup.model';
import SubmissionModel from '../../assessment/submission.model';
import AttemptModel from '../../models/Attempt';
import { Request } from '../../types/Request';
import UserModel from '../user.model';
import APIError from '../../helpers/APIError';
import PhaseModel from '../../phase/phase.model';
import { IUser } from '../IUser';

export const getUserInformation = async (
	req: Request & { query: { from: MomentInput; till: MomentInput } },
	res: Response,
	next: NextFunction
) => {
	const from = moment(req.query.from).toDate();
	const till = moment(req.query.till).toDate();
	const durationQuery = { $gte: from, $lte: till };
	const { superGroups, includeIsActive, format = 'csv' } = req.query;

	let subscriptionsQuery;
	if (superGroups) {
		subscriptionsQuery = { 'subscriptions.group': { $in: superGroups } };
	} else {
		next(new APIError('superGroups param is required'));
		return;
	}

	const allUsers = await UserModel.find({ ...subscriptionsQuery })
		.select('_id name subscriptions username createdAt')
		.exec();
	const allUserIds = allUsers.map((u) => u._id);
	const extraPropertiesByUserId = {};
	const isActiveKey = 'Is Active';
	if (includeIsActive === '1') {
		const userIdsWithAttempts = await AttemptModel.distinct('user', {
			startTime: durationQuery,
			user: { $in: allUserIds },
		});
		const userIdsWithSubmisssions = await SubmissionModel.distinct('user', {
			createdAt: durationQuery,
			user: { $in: allUserIds },
		});
		forEach(userIdsWithAttempts, (userId) => {
			if (!extraPropertiesByUserId[userId]) {
				extraPropertiesByUserId[userId] = {};
			}
			extraPropertiesByUserId[userId][isActiveKey] = 'Y';
			console.log(`${userId} is active`);
		});
		forEach(userIdsWithSubmisssions, (userId) => {
			if (!extraPropertiesByUserId[userId]) {
				extraPropertiesByUserId[userId] = {};
			}
			extraPropertiesByUserId[userId][isActiveKey] = 'Y';
			console.log(`${userId} is active`, extraPropertiesByUserId[userId]);
		});
	}
	const superGroupsFromDb = await SuperGroupModel.find({
		_id: superGroups,
	})
		.select('name')
		.exec();
	const superGroupsById = {};
	forEach(superGroupsFromDb, (superGroup) => {
		superGroupsById[superGroup._id] = superGroup;
	});

	const subGroups = await SubGroupModel.find({
		supergroup: { $in: superGroups },
	}).select('name supergroup');
	const subGroupsById = {};
	forEach(subGroups, (subGroup) => {
		subGroupsById[subGroup._id] = subGroup;
	});

	const phases = await PhaseModel.find({ supergroup: { $in: superGroups } })
		.select('name')
		.exec();
	const phasesById = {};
	forEach(phases, (phase) => {
		phasesById[phase._id] = phase;
	});

	const getPhaseSubGroupAndSuperGroups = (user: IUser) => {
		const data = {};
		user.subscriptions.forEach((superGroupWrapper) => {
			superGroupWrapper.subgroups.forEach((subGroupWrapper) => {
				subGroupWrapper.phases.forEach((phaseWrapper) => {
					if (phaseWrapper.active) {
						const phaseId = phaseWrapper.phase;
						const phase = phasesById[phaseId];
						const subGroup = subGroupsById[subGroupWrapper.group];
						const superGroup = superGroupsById[superGroupWrapper.group];
						data.Phase = get(phase, 'name');
						data['Sub Group'] = get(subGroup, 'name');
						data['Super Group'] = get(superGroup, 'name');
						if (!get(superGroup, 'name')) {
							data['Super Group'] = get(subGroup, ['supergroup'], superGroup);
							data['SbUd'] = superGroupsById;
						}
					}
				});
			});
		});
		return data;
	};
	const getExtraPropertiesByUserId = (userId) => {
		const props = extraPropertiesByUserId[userId];
		if (userId.toString() === '605488dbe7747716258534d8') {
			console.log('returning', props);
		}
		if (props) {
			return props;
		}
		return { [isActiveKey]: 'N' };
	};

	const jsonResponse = allUsers.map((user) => ({
		name: user.name,
		_id: user._id,
		username: user.username,
		'Sign Up Data(DD-MM-YY)': moment(user.createdAt).format('DD-MM-YY'),
		...getExtraPropertiesByUserId(user._id),
		...getPhaseSubGroupAndSuperGroups(user),
	}));
	if (format === 'csv') {
		res.attachment('user-data.csv');
		res.send(Papa.unparse(jsonResponse));
	} else {
		res.send({
			users: jsonResponse,
		});
	}
};
