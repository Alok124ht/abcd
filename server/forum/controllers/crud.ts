import { NextFunction, Response } from 'express';
import { get, map, some } from 'lodash';
import APIError from '../../helpers/APIError';
import { getActivePhasesFromSubscriptions } from '../../utils/phase';
import { Request } from '../../types/Request';
import ForumQuestionModel from '../models/ForumQuestion';
import { FilterQuery, Types } from 'mongoose';
import { ForumQuestionDocument } from '../types/ForumQuestion';
import ForumAnswerModel from '../models/ForumAnswer';
import { isAtLeast } from '../../utils/user/role';
import { UserRole } from '../../user/IUser';
import logger from '../../../config/winston';
import ForumCommentModel from '../models/ForumComment';
import UserModel from '../../user/user.model';

export async function postQuestion(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const {
			title,
			body,
			bodyType,
			files,
			tags,
			phase,
		}: {
			body: string;
			bodyType: 'text';
			title: string;
				files: { name: string;url: string; type: string; extension: string; }[];
			tags: {
				subjects: string[];
			};
			phase: string;
		} = req.body;
		const { role } = req.payload;
		const { user } = res.locals;
		const question = new ForumQuestionModel();
		question.title = title;
		question.body.text = body;
		question.bodyType = bodyType;
		question.files = files;
		question.tags = {
			subjects: map(get(tags, 'subjects'), (subjectId) =>
				Types.ObjectId(subjectId)
			),
		};
		question.createdBy = user._id;
		const phaseIds = getActivePhasesFromSubscriptions(
			get(user, ['subscriptions'])
		);
		if (
			!isAtLeast(UserRole.MENTOR, role) &&
			!some(phaseIds, (phaseId: string) => phaseId.toString() === phase)
		) {
			next(
				new APIError(
					`You can not post questions in this Phase: ${phase}, allowed phases: ${phaseIds
						.map((p) => p.toString())
						.join(', ')}`,
					402,
					true
				)
			);
			return;
		}
		question.phase = Types.ObjectId(phase);
		try {
			await question.save();
			res.send({ message: 'Your question has been posted', question });
		} catch (e) {
			next(
				new APIError(
					'Error occurred while posting your question. Please try again.',
					422,
					true
				)
			);
		}
	} catch (e) {
		logger.error(e);
		next(e);
	}
}

export async function postAnswer(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { role } = req.payload;
	const {
		question: questionId,
		body,
		bodyType,
		files,
	}: {
		question: string;
		body: string;
		bodyType: 'text';
			files: { name: string; url: string; type: string; extension: string }[];
	} = req.body;
	const question = await ForumQuestionModel.findById(questionId);
	const { user } = res.locals;
	const phaseIds = getActivePhasesFromSubscriptions(
		get(user, ['subscriptions'])
	);

	if (
		!question ||
		(!isAtLeast(UserRole.MENTOR, role) &&
			!some(phaseIds, (phaseId: string) => question.phase.equals(phaseId)))
	) {
		next(new APIError('You can not answer this question', 402, true));
		return;
	}

	const answer = new ForumAnswerModel();
	answer.question = question._id;
	answer.body.text = body;
	answer.bodyType = bodyType;
	answer.files = files;
	answer.createdBy = user._id;
	try {
		await answer.save();
		res.send({ message: 'Your answer has been posted.' });
	} catch (e) {
		logger.error(e);
		next(
			new APIError(
				'Error occurred while posting your answer. Please try again.',
				422,
				true
			)
		);
	}
}

export async function postComment(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { role } = req.payload;
	const {
		item: itemId,
		itemType,
		text,
	}: {
		item: string;
		itemType: string;
		text: string;
	} = req.body;
	try {
		if ('ForumQuestion' !== itemType && 'ForumAnswer' !== itemType) {
			next(new APIError('You can only comment on questions and answers.'));
			return;
		}
		let questionId = itemType === 'ForumQuestion' ? Types.ObjectId(itemId) : null;
		if (itemType === 'ForumAnswer') {
			const answer = await ForumAnswerModel.findById(itemId);
			if (!answer) {
				next(new APIError('Answer may have been deleted.', 422, true));
				return;
			}
			questionId = answer.question;
		}
		const question = await ForumQuestionModel.findById(questionId);
		const { user } = res.locals;
		const phaseIds = getActivePhasesFromSubscriptions(
			get(user, ['subscriptions'])
		);

		if (
			!question ||
			(!isAtLeast(UserRole.MENTOR, role) &&
				!some(phaseIds, (phaseId: string) => question.phase.equals(phaseId)))
		) {
			next(new APIError('You can not comment here', 402, true));
			return;
		}

		const answer = new ForumCommentModel();
		answer.item = Types.ObjectId(itemId);
		answer.itemType = itemType;
		answer.text = text;
		answer.createdBy = user._id;
		try {
			await answer.save();
			res.send({ message: 'Your answer has been posted.' });
		} catch (e) {
			logger.error(e);
			next(
				new APIError(
					'Error occurred while posting your answer. Please try again.',
					422,
					true
				)
			);
		}
	} catch (e) {
		next(e);
	}
}

export async function listRecent(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const {
		phase: phaseId,
		skip: skipRaw,
		subject: subjectId,
		limit: limitRaw,
	} = req.params;
	const skip = parseInt(skipRaw, 10);
	const limit = parseInt(limitRaw, 10);
	const query: FilterQuery<ForumQuestionDocument> = { phase: phaseId };
	if (subjectId !== 'all') {
		query['tags.subjects'] = subjectId;
	}
	try {
		const total = await ForumQuestionModel.countDocuments(query);
		const questions = await ForumQuestionModel.find(query)
			.skip(skip)
			.limit(limit)
			.populate('createdBy', 'name dp username')
			.sort({ _id: -1 });
		res.send({ items: questions, total });
	} catch (e) {
		next(e);
	}
}

export async function getQuestion(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const { question: questionId } = req.params;
		const { role } = req.payload;
		const { user } = res.locals;
		const phaseIds = getActivePhasesFromSubscriptions(
			get(user, ['subscriptions'])
		);

		const questionQuery: FilterQuery<ForumQuestionDocument> = {
			_id: questionId,
		};
		if (!isAtLeast(UserRole.MENTOR, role)) {
			questionQuery.phase = { $in: phaseIds };
		}

		const question = await ForumQuestionModel.findOne(questionQuery);
		if (!question) {
			next(new APIError('Question not found', 404, true));
		} else {
			const answers = await ForumAnswerModel.find({
				question: question._id,
			});
			const comments = await ForumCommentModel.find({
				$or: [
					{ item: question._id, itemType: 'ForumQuestion' },
					{ item: { $in: answers.map((a) => a._id) }, itemType: 'ForumAnswer' },
				],
			});
			const allInvolvedUserIds: Types.ObjectId[] = [
				question.createdBy,
				...answers.map((answer) => answer.createdBy),
				...comments.map((comment) => comment.createdBy),
			];
			const users = await UserModel.find({
				_id: { $in: allInvolvedUserIds },
			}).select('dp name username');
			res.send({
				question,
				answers,
				totalAnswers: answers.length,
				users,
				comments,
			});
		}
	} catch (e) {
		next(e);
	}
}
