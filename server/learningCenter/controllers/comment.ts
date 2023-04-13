import moment from 'moment';
import { NextFunction, Response } from 'express';
import { Request } from '../../types/Request';
import Comment, { VideoCommentUserPopulated } from '../models/Comment';
import APIError from '../../helpers/APIError';

const addComment = (req: Request, res: Response) => {
	const { id: userId } = req.payload;
	const { text, videoId } = req.body;
	if (!text || !text.trim()) {
		res.status(422).send({ message: 'Please enter a message' });
	} else if (!videoId) {
		res.status(404).send({ message: 'Not found' });
	} else {
		const comment = new Comment({ text, user: userId, video: videoId });
		comment.save((saveError, savedComment) => {
			if (saveError) {
				res.status(422).send({ message: 'Unknown error occurred' });
			} else {
				res.send({ savedComment });
			}
		});
	}
};

const getComments = (req: Request, res: Response, next: NextFunction) => {
	const { videoId } = req.query;
	if (typeof videoId !== 'string') {
		next(new APIError('Video id not provided'));
		return;
	}
	Comment.find({ video: videoId })
		.populate('user', 'username dp name email mobileNumber')
		.sort({ createdAt: -1 })
		.exec((error, comments: VideoCommentUserPopulated[]) => {
			if (error) {
				res.status(500).send({ message: 'Internal server error' });
			} else {
				const lastComment = comments[comments.length - 1];
				const lastCommentAt = lastComment
					? moment(lastComment.createdAt)
					: moment().subtract(1, 'years');
				const refreshInterval = moment()
					.subtract(30, 'minutes')
					.isBefore(lastCommentAt)
					? 1 * 60 * 1000
					: 4 * 60 * 1000;

				res.send({
					items: comments.map((comment) => ({
						...comment.toObject(),
						user: {
							name: '',
							mobileNumber: '',
							email: '',
							...comment.user.toObject(),
						},
					})),
					refreshInterval,
					lastCommentAt,
					lastComment,
				});
			}
		});
};

export default {
	addComment,
	getComments,
};
