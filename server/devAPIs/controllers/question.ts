import { forEach, map, some } from 'lodash';
import APIError from '../../helpers/APIError';
import { Response, NextFunction } from 'express';
import { Request } from '../../types/Request';
import { model, Types } from 'mongoose';
import { Attempt } from '../../types/Attempt';

const Attempt = model<Attempt>('Attempt');
const QuestionStatistics = model('QuestionStatistics');

export function fixMissingAttempts(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { skip: skipRaw, limit: limitRaw } = req.query;
	let skip = typeof skipRaw !== 'string' ? 0 : parseInt(skipRaw, 10);
	skip = isNaN(skip) ? 0 : skip;
	let limit = typeof limitRaw !== 'string' ? 1000 : parseInt(limitRaw, 10);
	limit = isNaN(limit) ? 1000 : limit;

	QuestionStatistics.find()
		.skip(skip)
		.limit(limit)
		.then((items) => {
			Promise.all(
				map(items, (item) => {
					return new Promise((resolve) => {
						Attempt.count({ question: item.question, _id: { $nin: item.attempts } })
							.select('_id')
							.then((count) => {
								if (count > item.attempts.length) {
									resolve(count - item.attempts.length);
									console.log('calling addMissingAttempts');
									item.addMissingAttempts();
								} else {
									resolve(0);
								}
							})
							.catch((err) => {
								console.error(err);
								resolve(err.message);
							});
					});
				})
			).then((items) => {
				let count = 0;
				forEach(items, (item) => {
					if (typeof item !== 'string') {
						count += item;
					}
				});
				res.send({
					count,
					items: items.filter((item) => typeof item === 'string' || item > 0),
				});
			});
		});
	return;
	Attempt.find({})
		.select('question')
		.then((attempts) => {
			console.log(`${attempts.length}attempts found`);
			const attemptsByQuestionId: { [questionId: string]: Types.ObjectId[] } = {};
			attempts.forEach((attempt) => {
				if (!attemptsByQuestionId[attempt.question.toString()]) {
					attemptsByQuestionId[attempt.question.toString()] = [];
				}
				attemptsByQuestionId[attempt.question.toString()].push(attempt._id);
				Promise.all(
					map(attemptsByQuestionId, (attempts, questionId) => {
						return new Promise((resolve) => {
							console.log('p');
							QuestionStatistics.findOne({ question: questionId })
								.select('attempts')
								.then((qs) => {
									if (!qs) {
										console.log('qnf');
										resolve(`QS not found for ${questionId}`);
									} else {
										let count = 0;
										qs.attempts.forEach((qsAttemptId) => {
											if (!some(attempts, (attemptId) => attempt.equals(qsAttemptId))) {
												count += 1;
											}
										});
										if (count > 0) {
											resolve(`${count} attempts not found`);
											console.log(count);
										} else {
											console.log('mm');
											resolve(null);
										}
									}
								})
								.catch((err) => {
									console.log('ee');
									resolve(err.message);
								});
						});
					})
				).then((result) => {
					res.send(result);
				});
			});
		})
		.catch(next);
	// const questionId = req.query.question;
	// if (!questionId || typeof questionId !== 'string') {
	// 	next(new APIError('Question ID not present', 422, true));
	// 	return;
	// }
	// QuestionStatistics.findByQuestionId(questionId)
	// 	.then((questionStatistics) => {
	// 		questionStatistics.addMissingAttempts();
	// 		res.send('fixing');
	// 	})
	// 	.catch(next);
}
