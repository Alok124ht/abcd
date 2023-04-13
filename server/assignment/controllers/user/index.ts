import { NextFunction, Response } from 'express';
import AssignmentSubmission from '../../models/AssignmentSubmission';
import { Request } from '../../../types/Request';
import AWS from 'aws-sdk';
import APIError from '../../../helpers/APIError';
import { getRandomString } from '../../../utils/string';
import s3 from '../../../aws/s3';

export async function submit(req: Request, res: Response, next: NextFunction) {
	const { assignmentId, files } = req.body;
	const { id: userId } = req.payload;
	const assignmentSubmission = new AssignmentSubmission({
		files,
		assignment: assignmentId,
		user: userId,
	});
	assignmentSubmission.save((error) => {
		if (error) {
			next(error);
		} else {
			res.send(assignmentSubmission);
		}
	});
}

export async function getSubmission(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { id: userId, role } = req.payload;
	const { assignment, userId: user } = req.query;
	const userToSearch = role === 'parent' ? user : userId;
	if (typeof assignment !== 'string') {
		next(new APIError('Assignment Id not found', 422, true));
		return;
	}
	try {
		const submissions = await AssignmentSubmission.find({
			user: userToSearch,
			assignment,
		});
		res.send(submissions);
	} catch (e) {
		next(e);
	}
}

export const getUploadPolicy = (req: Request, res: Response) => {
	const { id: userId } = req.payload;
	const { mime, fileName } = req.body;
	const filePath = `${
		process.env.AWS_LEARNING_CENTER_DOCUMENTS_BASE_PATH
	}/assignment-submissions/u/${userId}/${getRandomString(20)}/${fileName}`;
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

export async function getAllSubmissions(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const { id: userId, role } = req.payload;
		const userToSearch = role === 'parent' ? req.query.userId : userId;
		const submissions = await AssignmentSubmission.find({
			user: userToSearch,
		}).select('assignment createdAt grades');
		res.send({ items: submissions });
	} catch (e) {
		next();
	}
}
