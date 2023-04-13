import { FilterQuery, Types } from 'mongoose';
import { has, map } from 'lodash';
import UserGroupsCache from '../../../cache/UserGroups';
import { NextFunction, Response } from 'express';
import { Request } from '../../../types/Request';
import Assignment from '../../models/Assignment';
import AWS from 'aws-sdk';
import AssignmentSubmission from '../../models/AssignmentSubmission';
import APIError from '../../../helpers/APIError';
import {
	AssignmentDocument,
	Permission,
} from '../../../assignment/types/Assignment';
import { parseAsString } from '../../../utils/query';
import PlaylistModel from '../../../learningCenter/models/Playlist';
var mongoose = require('mongoose');

const s3 = new AWS.S3({
	region: process.env.AVATAR_S3_AWS_REGION,
	accessKeyId: process.env.GENERAL_AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.GENERAL_AWS_SECRET_ACCESS_KEY,
});
const getFilename = () => {
	function makeid(length: number) {
		let result = '';
		const characters =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const charactersLength = characters.length;
		for (let i = 0; i < length; i += 1) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
		}
		return result;
	}
	return makeid(20);
};

export const getUploadPolicy = (req: Request, res: Response) => {
	const { id: userId } = req.payload;
	const { mime, fileName } = req.body;
	const filePath = `${
		process.env.AWS_LEARNING_CENTER_DOCUMENTS_BASE_PATH
	}/assignments/u/${userId}/${getFilename()}/${fileName}`;
	return s3.createPresignedPost(
		{
			Bucket: process.env.AWS_LEARNING_CENTER_DOCUMENTS_BUCKET,
			Expires: 3600,
			Conditions: [{ key: filePath }],
			Fields: { acl: 'public-read', key: filePath, mime, 'content-type': mime },
		},
		(error: Error, data: any) => {
			if (error) {
				res.status(422).send({ message: 'Unable to create policy', error });
			} else {
				res.send({ data, filePath });
			}
		}
	);
};

export async function createAssignment(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const {
		title,
		files,
		description,
		thumbNailsUrls,
		markingScheme,
		tags,
		submissionDeadline,
		permissions,
	} = req.body;
	const { id: userId } = req.payload;
	const assignment = new Assignment({
		description,
		files,
		title,
		tags,
		thumbNailsUrls,
		markingScheme,
		submissionDeadline,
	});
	const updatedPermissions: Permission[] = [
		{ item: new Types.ObjectId(userId), itemType: 'User' },
	];
	if (Array.isArray(permissions)) {
		permissions.forEach((permission) => {
			if (['User', 'UserGroup'].includes(permission.itemType) && permission.item) {
				updatedPermissions.push({
					item: permission.item,
					itemType: permission.itemType,
				});
			}
		});
	}
	assignment.permissions = updatedPermissions;
	assignment.createdBy = new Types.ObjectId(userId);
	try {
		await assignment.save();
		res.send({ assignment });
	} catch (e) {
		next(e);
	}
}

export async function updateAssignment(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const {
		id: assignmentId,
		title,
		files,
		description,
		permissions,
		thumbNailsUrls,
		markingScheme,
		tags,
		submissionDeadline,
	} = req.body;
	try {
		const assignment = await Assignment.findById(assignmentId);
		if (!assignment) {
			throw new Error('Assignment not found');
		} else {
			let resetGrades = false;
			if (has(req.body, 'title') && title) {
				assignment.title = title;
			}
			if (has(req.body, 'files')) {
				assignment.files = files;
			}
			if (has(req.body, 'description') && description) {
				assignment.description = description;
			}
			if (has(req.body, 'thumbNailsUrls')) {
				assignment.thumbNailsUrls = thumbNailsUrls;
			}
			if (has(req.body, 'markingScheme')) {
				assignment.markingScheme = markingScheme;
				// resetGrades = true;
			}
			if (has(req.body, 'tags')) {
				assignment.tags = tags;
			}
			if (has(req.body, 'submissionDeadline')) {
				assignment.submissionDeadline = submissionDeadline;
			}
			if (has(req.body, 'permissions')) {
				assignment.permissions = permissions;
			}
			if (assignment.isModified()) {
				await assignment.save();
				if (resetGrades) {
					await AssignmentSubmission.updateMany(
						{ assignment: assignment._id },
						{ $set: { grades: [] } }
					);
				}
			}
			res.send(assignment);
		}
	} catch (e) {
		next(e);
	}
}

export async function listAssignments(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { id: userId, role } = req.payload;
	if (typeof req.query.skip !== 'string') {
		next(new APIError('Skip is required'));
		return;
	}
	if (typeof req.query.limit !== 'string') {
		next(new APIError('Limit is required'));
		return;
	}
	const skip = parseInt(req.query.skip, 10);
	const limit = parseInt(req.query.limit, 10);
	const q = req.query.q;
	const _id = req.query._id;
	const query: FilterQuery<AssignmentDocument> = {};
	if (typeof q === 'string') {
		const regex = {
			$regex: new RegExp(q, 'i'),
		};
		query['$or'] = [{ title: regex }];
		if (Types.ObjectId.isValid(q)) {
			query['$or'].push({ _id: Types.ObjectId(q) });
		}
	}
	if (_id) {
		/**
		 * This is get assignment
		 */
		query._id = _id;
	}
	if (role !== 'super') {
		let groupIdsOfUser;
		try {
			groupIdsOfUser = await UserGroupsCache.getGroupsOfUser(userId);
		} finally {
			const orCondition: any[] = [
				{
					itemType: 'User',
					item: Types.ObjectId(userId),
				},
			];
			if (Array.isArray(groupIdsOfUser) && groupIdsOfUser.length) {
				orCondition.push({
					itemType: 'UserGroup',
					item: { $in: map(groupIdsOfUser, (id) => Types.ObjectId(id)) },
				});
			}
			query.permissions = {
				$elemMatch: {
					$or: orCondition,
				},
			};
		}
	}
	try {
		const total = await Assignment.countDocuments(query);
		const assignments = await Assignment.find(query)
			.skip(skip)
			.limit(limit)
			.populate({
				path: 'createdBy',
				select: 'name email',
			})
			.sort({ _id: -1 });

		if (_id) {
			if (!assignments.length) {
				next(new APIError('Not found'));
			} else {
				res.send(assignments[0]);
			}
		} else {
			res.send({ items: assignments, total });
		}
	} catch (error) {
		next(error);
	}
}

export async function listSubmissions(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { id: assignmentId } = req.query;
	try {
		const items = await AssignmentSubmission.find({
			assignment: assignmentId as string,
		})
			.populate({
				path: 'user',
				select: 'name email mobileNumber',
			})
			.sort({ createdAt: -1 });
		res.send({ items, total: items.length, assignmentId });
	} catch (e) {
		next(e);
	}
}

export async function setGradesForSubmission(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { grades, submissionId, assignmentId } = req.body;
	try {
		const submission = await AssignmentSubmission.findOne({
			_id: submissionId,
			assignment: assignmentId,
		});
		if (!submission) {
			throw new APIError('Submission not found', 404, true);
		}
		submission.grades = grades;
		await submission.save();
		res.send(submission);
	} catch (e) {
		next(e);
	}
}

export async function getGradesGraphData(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const phaseId = parseAsString(req.query.phase);
	// const userId = parseAsString(req.query.user);

	try {
		const playlists = await PlaylistModel.aggregate([
			{
				$match: {
					accessibleTo: {
						$elemMatch: {
							value: new mongoose.Types.ObjectId(phaseId),
						},
					},
					resourceType: 'Assignment',
				},
			},
			{
				$unwind: '$tags',
			},
			{
				$unwind: '$items',
			},
			{
				$lookup: {
					from: 'playlistitems', // name of mongoDB collection, NOT mongoose model
					localField: 'items',
					foreignField: '_id',
					as: 'item',
				},
			},
			{
				$unwind: '$item',
			},
			{
				$project: {
					_id: 1,
					title: 1,
					subjectName: '$tags.value',
					subjectId: '$tags._id',
					assignmentId: '$item.resource',
				},
			},
			{
				$lookup: {
					from: 'assignments', // name of mongoDB collection, NOT mongoose model
					localField: 'assignmentId',
					foreignField: '_id',
					as: 'assignment',
				},
			},
			{
				$unwind: '$assignment',
			},
			{
				$project: {
					_id: 1,
					title: 1,
					subjectName: 1,
					subjectId: 1,
					assignmentId: 1,
					assignment: 1,
					scheme: '$assignment.markingScheme.sections',
				},
			},
			{
				$project: {
					_id: 1,
					title: 1,
					subjectName: 1,
					subjectId: 1,
					assignmentId: 1,
					// assignment:1,
					scheme: 1,
					maxMarks: {
						$sum: '$scheme.maxMarks',
					},
				},
			},
			{
				$group: {
					_id: '$subjectId',
					subject: { $first: '$subjectName' },
					assignments: {
						$push: {
							subject: '$subjectName',
							assignmentId: '$assignmentId',
							maxMarks: '$maxMarks',
							marks: 0,
							percent: 0,
						},
					},
				},
			},
		]);
		res.send(playlists);
	} catch (e) {
		next(e);
	}
}

export async function getUserGrades(
	req: Request,
	res: Response,
	next: NextFunction
) {
	// const phaseId = parseAsString(req.query.phase);
	const userId = parseAsString(req.query.user);

	try {
		const submissions = await AssignmentSubmission.aggregate([
			{
				$match: {
					user: new mongoose.Types.ObjectId(userId),
				},
			},
			{
				$project: {
					_id: 1,
					assignmentId: '$assignment',
					// grades:1,
					marks: {
						$sum: '$grades.marks',
					},
				},
			},
		]);

		res.send(submissions);
	} catch (e) {
		next(e);
	}
}
