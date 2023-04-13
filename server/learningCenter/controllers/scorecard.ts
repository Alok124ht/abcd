import { Request } from '../../types/Request';
import Papa from 'papaparse';
import { Response, NextFunction } from 'express';
import { getScorecard } from '../lib/scorecard';
import { Types } from 'mongoose';
import { isAtLeastMentor } from '../../utils/user/role';
import { parseAsString, parseAsStringArray } from '../../utils/query';
import PlaylistModel from '../models/Playlist';
import { ResourceType } from '../../types/Playlist';
import { PlaylistItem } from '../../types/PlaylistItem';
import { AssignmentDocument } from '../../assignment/types/Assignment';
import UserModel from '../../user/user.model';
import AssignmentSubmissionModel from '../../assignment/models/AssignmentSubmission';
import { AssignmentSubmissionDocument } from '../../assignment/types/AssignmentSubmission';
import { forEach, get } from 'lodash';
import { createItemsById } from '../../utils/items';
import Assignment from '../../assignment/models/Assignment';

/**
 * Get my scorecard
 */
export async function getMyScorecard(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { id: userId, role } = req.payload;
	const ofUser = isAtLeastMentor(role)
		? parseAsString(req.query.user) || userId
		: userId;
	try {
		const response = await getScorecard(Types.ObjectId(ofUser));
		res.send({ ...response, ofUser });
	} catch (e) {
		next(e);
	}
}

export async function getGradesForPhase(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const phases = parseAsStringArray(req.query.phases);
	try {
		const playlists = await PlaylistModel.find({
			'accessibleTo.value': { $in: phases.map((p) => Types.ObjectId(p)) },
			resourceType: ResourceType.Assignment,
		})
			.select('items')
			.populate('items', 'resource');
		const assignmentIds: Types.ObjectId[] = [];
		playlists.forEach((playlist) => {
			playlist.items.forEach((item) => {
				const { resource: resourceRaw } = item as unknown as PlaylistItem;
				const resource = resourceRaw as unknown as AssignmentDocument;
				assignmentIds.push(resource._id);
			});
		});
		const allUsersOfPhase = await UserModel.find({
			'subscriptions.subgroups.phases.phase': { $in: phases },
		}).select('name username email');
		const assignmentSubmissions = await AssignmentSubmissionModel.find({
			user: { $in: allUsersOfPhase.map((u) => u._id) },
			assignment: { $in: assignmentIds },
		}).sort({ _id: -1 });
		const allAssignments = await Assignment.find({ _id: { $in: assignmentIds } });
		const submissionsByUserId: {
			[userId: string]: AssignmentSubmissionDocument[];
		} = {};
		forEach(assignmentSubmissions, (submission) => {
			const userId = submission.user.toString();
			if (!submissionsByUserId[userId]) {
				submissionsByUserId[userId] = [];
			}
			submissionsByUserId[userId].push(submission);
		});
		const list: any[] = [];
		forEach(allUsersOfPhase, (user) => {
			const userData = [user.name, user.email, user._id.toString()];
			const submissionsByAssignmentId: {
				[assignmentId: string]: AssignmentSubmissionDocument;
			} = createItemsById(get(submissionsByUserId, [user._id], []), 'assignment');
			forEach(allAssignments, (assignment) => {
				const { title, _id, maxMarks } = assignment;
				const submission = get(submissionsByAssignmentId, _id);
				const assignmentData = [title, _id];
				const submissionData = [];
				if (!submission) {
					// not submitted
					submissionData.push('Not submitted');
				} else if (
					!submission.grades ||
					!Array.isArray(submission.grades) ||
					!submission.grades.length
				) {
					// not graded
					submissionData.push('Not graded');
				} else {
					const totalScored = submission.grades.reduce(
						(acc, g) =>
							acc + (typeof g.marks === 'number' && !isNaN(g.marks) ? g.marks : 0),
						0
					);
					submissionData.push(totalScored);
				}

				submissionData.push(maxMarks);
				list.push([...userData, ...assignmentData, ...submissionData]);
			});
		});
		const csv = Papa.unparse(list, {
			columns: [
				'Name',
				'Email',
				'User Id',
				'Assignment',
				'Assignment Id',
				'Score',
				'Max Marks',
			],
		});
		res.attachment('text/csv');
		res.send(csv);
		// res.send({ list });
	} catch (e) {
		console.error(e);
		next(e);
	}
}
