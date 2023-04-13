import { Response, NextFunction } from 'express';
import Question from '../question.model';

import { Request } from '../../types/Request';
import APIError from '../../helpers/APIError';
import { QuestionTypes } from '../QuestionType';
import { QuestionAnswerRange, QuestionOption, Content } from '../IQuestion';

interface ChangeQuestionTypeRequest extends Request {
	body: {
		_id: string;
		type: QuestionTypes;
		options: QuestionOption[];
		range: QuestionAnswerRange;
		questionContent: Content;
	};
}

export async function changeQuestionType(
	req: ChangeQuestionTypeRequest,
	res: Response,
	next: NextFunction
) {
	const {
		_id: questionId,
		type: targetType,
		options: newOptions,
		range: newRange,
		questionContent,
	} = req.body;
	try {
		const question = await Question.findById(questionId);
		if (!question) {
			next(new APIError('Question not found', 404, true));
		} else {
			if ([QuestionTypes.LINKED_MCMC, QuestionTypes.MCMC].includes(targetType)) {
				question.changeTypeToMultipleCorrect(
					targetType,
					newOptions,
					questionContent
				);
			} else if (
				[QuestionTypes.LINKED_MCSC, QuestionTypes.MCSC].includes(targetType)
			) {
				question.changeTypeToSingleCorrect(targetType, newOptions, questionContent);
			} else if (
				[QuestionTypes.LINKED_RANGE, QuestionTypes.RANGE].includes(targetType)
			) {
				question.changeTypeToRange(targetType, newRange, questionContent);
			} else {
				next(new APIError(`Invalid target format: ${targetType}`));
				return;
			}
			await question.save();
			res.send({ question });
		}
	} catch (e) {
		next(e);
	}
}
