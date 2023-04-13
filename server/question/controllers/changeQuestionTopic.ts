import { Response, NextFunction } from 'express';
import Question from '../question.model';

import { Request } from '../../types/Request';
import APIError from '../../helpers/APIError';
import TopicModel from '../../topic/topic.model';

interface ChangeQuestionTopicRequest extends Request {
	body: {
		_id: string;
		subTopic: string;
	};
}

export async function changeQuestionTopic(
	req: ChangeQuestionTopicRequest,
	res: Response,
	next: NextFunction
) {
	const { _id: questionId, subTopic: subTopicId } = req.body;
	try {
		const question = await Question.findById(questionId);
		if (!question) {
			next(new APIError(`Question not found. ${questionId}`, 404, true));
		}
		if (question.isPublished) {
			next(
				new APIError(
					'Could not change topic of this question as this question has been published.',
					422,
					true
				)
			);
		} else {
			const subTopic = await TopicModel.getSubTopicForId(subTopicId);
			const topic = await TopicModel.getTopicForSubTopicId(subTopicId);
			if (!subTopic) {
				next(new APIError('Invalid sub-topic selected', 422, true));
				return;
			}
			if (!topic) {
				next(new APIError('Topic not found for sub-topic', 422, true));
				return;
			}
			question.topic = topic._id.toString();
			question.subTopic = subTopicId;
			question.sub_topic = subTopicId;
			question.topicId = subTopic.id;
			await question.save();
			res.send({ question });
		}
	} catch (e) {
		next(e);
	}
}
