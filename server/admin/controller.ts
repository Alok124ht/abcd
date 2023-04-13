import { Request } from '../types/Request';
import { NextFunction, Response } from 'express';
import { model, FilterQuery, Types } from 'mongoose';
import { forEach, get, map, size } from 'lodash';
import convertArrayToCSV from 'convert-array-to-csv';
import Bottleneck from 'bottleneck';
import { Attempt } from '../types/Attempt';
import Client from '../client/client.model';
import {
	AssessmentCorePopulatedQuestionsInterface,
	AssessmentSectionPopulatedQuestion,
} from '../types/AssessmentCore';
import User from '../user/user.model';
import { IAnswer, QuestionTypes } from '../question/QuestionType';
import logger from '../../config/winston';
import Topic from '../topic/topic.model';
import AssessmentWrapper from '../assessment/assessmentWrapper.model';
import AssessmentCore from '../assessment/assessmentCore.model';
import Submission from '../assessment/submission.model';
import APIError from '../helpers/APIError';
import Draft from '../draft/draft.model';
import { AssessmentWrapperInterface } from '../types/AssessmentWrapper';

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
	const limiter = new Bottleneck({
		maxConcurrent: 10,
	});

	QuestionStatistics.find()
		.skip(skip)
		.limit(limit)
		.then((items) => {
			Promise.all(
				map(items, (item) => {
					return new Promise((resolve) => {
						Attempt.count({
							question: item.question,
							_id: { $nin: item.attempts },
						})
							.select('_id')
							.then((count) => {
								if (count > item.attempts.length) {
									resolve(count - item.attempts.length);
									limiter.schedule(() => {
										return item.addMissingAttempts();
									});
								} else {
									resolve(0);
								}
							})
							.catch((err) => {
								resolve(err.message);
							});
					});
				})
			)
				.then((items: (number | string)[]) => {
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
				})
				.catch(next);
		})
		.catch(next);
}

export function getAttemptStartedInPeriod(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { startDate, endDate, wrapperIds } = req.query;
	const FlowLog = model('FlowLog');

	const matchQuery: any = {};
	if (typeof startDate === 'number' || typeof startDate === 'string') {
		if (!matchQuery.createdAt) {
			matchQuery.createdAt = {};
		}
		matchQuery.createdAt.$gte = new Date(parseInt(startDate));
	}
	if (typeof endDate === 'number' || typeof endDate === 'string') {
		if (!matchQuery.createdAt) {
			matchQuery.createdAt = {};
		}
		matchQuery.createdAt.$lte = new Date(parseInt(endDate));
	}
	if (wrapperIds) {
		matchQuery.wrapperId = { $in: wrapperIds };
	}

	FlowLog.aggregate([
		{
			$match: matchQuery,
		},
		{
			$group: {
				_id: { user: '$user', wrapperId: '$wrapperId' },
				count: {
					$sum: 1,
				},
			},
		},
		{
			$group: {
				_id: '$_id.wrapperId',
				count: {
					$sum: 1,
				},
			},
		},
	]).exec((countError, aggregate) => {
		if (countError) {
			next(countError);
		} else {
			const countByWrapperId: any = {};
			aggregate.forEach((item) => {
				countByWrapperId[item._id] = item.count;
			});
			res.send({ countByWrapperId, matchQuery });
		}
	});
}

interface AssessmentResponse {
	sections: {
		questions: {
			answer?: IAnswer;
			state: number;
			time?: number;
		}[];
	}[];
}

interface SubmissionMeta {
	sections: {
		questions: { mark: number; correct: number }[];
	}[];
}

function getHumanReadableAnswers(
	response: AssessmentResponse,
	assessmentSections: AssessmentSectionPopulatedQuestion[],
	meta: SubmissionMeta
): [(string | number)[], { mark: number; correct: number }[]] {
	const readableAnswers: (string | number)[] = [];
	const readableMeta: { mark: number; correct: number }[] = [];
	forEach(response.sections, (responseSection, sectionIndex) => {
		forEach(responseSection.questions, (questionResponse, questionIndex) => {
			try {
				if (questionResponse.answer !== null) {
					const question = get(assessmentSections, [
						sectionIndex,
						'questions',
						questionIndex,
					]);
					const questionMeta = get(meta, [
						'sections',
						sectionIndex,
						'questions',
						questionIndex,
					]);
					readableMeta.push(questionMeta);
					if (
						[QuestionTypes.MCSC, QuestionTypes.LINKED_MCSC].includes(
							question.question.type
						)
					) {
						const answer: string = questionResponse.answer as string;
						let selectedOptionIndex = -1;
						question.question.options.some((option, optionIndex) => {
							if (option._id.equals(answer)) {
								selectedOptionIndex = optionIndex;
							}
						});
						readableAnswers.push(
							String.fromCharCode('A'.charCodeAt(0) + selectedOptionIndex)
						);
					} else if (
						[QuestionTypes.MCMC, QuestionTypes.LINKED_MCMC].includes(
							question.question.type
						)
					) {
						const answers: string[] = questionResponse.answer as string[];
						const selectedOptionIndexes: number[] = [];
						answers.forEach((answer) => {
							question.question.multiOptions.some((option, optionIndex) => {
								if (option._id.equals(answer)) {
									selectedOptionIndexes.push(optionIndex);
								}
							});
						});
						readableAnswers.push(
							selectedOptionIndexes.length
								? selectedOptionIndexes
										.map((selectedOptionIndex) =>
											String.fromCharCode('A'.charCodeAt(0) + selectedOptionIndex)
										)
										.join(' ')
								: size(answers)
								? `EMPTY ${JSON.stringify(answers)}`
								: 'NA'
						);
					} else if (
						[
							QuestionTypes.INT,
							QuestionTypes.RANGE,
							QuestionTypes.LINKED_RANGE,
						].includes(question.question.type)
					) {
						const answer: number = questionResponse.answer as number;
						readableAnswers.push(answer);
					} else {
						readableAnswers.push('Unsupported answer');
					}
				} else {
					readableMeta.push({ mark: 0, correct: -1 });
					readableAnswers.push('NA');
				}
			} catch (e) {
				readableAnswers.push('Error');
				logger.error(
					`failed to generate human readable answer for ${questionResponse}`
				);
			}
		});
	});
	return [readableAnswers, readableMeta];
}

export async function getSubmissionResponseCSV(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { wrapperId, userId, username, responseType = 'text' } = req.query;
	try {
		const assessmentWrapper = await AssessmentWrapper.findById(wrapperId);
		const assessmentCore = ((await AssessmentCore.findById(
			assessmentWrapper.core
		).populate({
			path: 'sections.questions.question',
		})) as unknown) as AssessmentCorePopulatedQuestionsInterface;
		const submissionsQuery: any = { assessmentWrapper: wrapperId, graded: true };
		if (userId) {
			submissionsQuery.user = userId;
		}
		if (typeof username == 'string' && username.trim()) {
			const user = await User.findOne({ username }).select('_id');
			if (!user) {
				throw new Error('User not found');
			}
			submissionsQuery.user = user._id;
		}
		const submissions = await Submission.find(submissionsQuery)
			.populate({
				path: 'user',
				select: 'name username email',
			})
			.select('user response meta');
		const humanReadableAnswersWithUser = map(submissions, (submission) => {
			const [questions, questionMeta] = getHumanReadableAnswers(
				submission.response,
				assessmentCore.sections,
				submission.meta
			);
			return {
				user: submission.user,
				meta: get(submission, ['meta']),
				questions,
				questionMeta: questionMeta,
			};
		});
		const rows: (string | number)[][] = [];
		const headers = [
			'Question No',
			'Username',
			'Name',
			"User's Answer",
			'Marks Awarded',
			'Is correct',
			'Sub Topic Id',
			'Section',
		];
		if (responseType !== 'json') {
			rows.push(headers);
		}
		forEach(humanReadableAnswersWithUser, (humanReadableAnswerWithUser) => {
			let questionNumber = 0;
			assessmentCore.sections.forEach((section) => {
				section.questions.forEach((question) => {
					const row: (string | number)[] = [];
					row.push(questionNumber + 1);
					row.push(humanReadableAnswerWithUser.user.username);
					row.push(humanReadableAnswerWithUser.user.name);
					const questionResponse = get(humanReadableAnswerWithUser, [
						'questions',
						questionNumber,
					]);
					row.push(questionResponse);
					const questionMeta = get(humanReadableAnswerWithUser, [
						'questionMeta',
						questionNumber,
					]);
					row.push(get(questionMeta, 'mark'));
					const isCorrect = get(questionMeta, 'correct');
					if (isCorrect === 1) {
						row.push('yes');
					} else if (isCorrect === 0) {
						row.push('no');
					} else {
						row.push('N/A');
					}
					row.push(question.question.sub_topic);
					row.push(section.name);

					rows.push(row);
					questionNumber += 1;
				});
			});
		});

		if (responseType === 'json') {
			res.send(rows);
		} else {
			res.type('text/csv');
			res.attachment(`responses-${wrapperId}.csv`);
			res.send(convertArrayToCSV(rows));
		}
	} catch (e) {
		next(new APIError(e.message, 500, true));
	}
}

export async function downloadQuestionTopicsOfAssessment(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { type, id } = req.query;
	const promise =
		type === 'draft'
			? Draft.findOne({ _id: id })
					.populate({
						path: 'sections.questions.question',
						populate: {
							path: 'usedIn',
							select: 'client identifier duration wrappers',
							populate: [
								{
									path: 'client',
									select: 'name',
								},
								{
									path: 'wrappers.wrapper',
									select: 'phases permissions',
								},
							],
						},
					})
					.exec()
			: AssessmentCore.findOne({ _id: id })
					.populate('sections.questions.question')
					.exec();
	try {
		const item = await promise;
		const header = ['Q.No.', 'Topic', 'Level', 'Client'];
		const rows = [header];
		const topicsById: { [key: string]: { name: string } } = {};
		const allTopics = await Topic.list();
		allTopics.topics.forEach((topic) => {
			topicsById[topic._id.toString()] = topic;
		});
		let qNo = 0;
		const clients = await Client.find().exec();
		const clientsByPhaseId: { [key: string]: any } = {};
		const clientById = {};
		clients.forEach((client) => {
			clientById[client._id.toString()] = client;
			client.phases.forEach((phase) => {
				if (!clientsByPhaseId[phase.toString()]) {
					clientsByPhaseId[phase.toString()] = [];
				}
				clientsByPhaseId[phase.toString()].push(client._id.toString());
			});
		});
		item.sections.map((section) => {
			section.questions.map(({ question, topic, sub_topic: subTopic }) => {
				qNo += 1;

				const clientsForQuestion = [];
				forEach(get(question, ['usedIn']), (assessmentCore) => {
					console.log('yolo');
					// console.log(assessmentCore);
					forEach(get(assessmentCore, ['wrappers']), ({ wrapper }) => {
						// console.log(wrapper);
						forEach(get(wrapper, ['phases']), (phaseItem) => {
							const phaseId = get(phaseItem, ['phase']);
							const clients = map(clientsByPhaseId[phaseId], (clientId) =>
								get(clientById, [clientId, 'name'])
							);
							clients.forEach((clientName) => {
								if (!clientsForQuestion.includes(clientName)) {
									clientsForQuestion.push(clientName);
								}
							});

							// console.log(phaseId, clients);
						});
					});
					console.log('bolo');
				});
				rows.push([
					qNo,
					topicsById[topic].name,
					question.level,
					clientsForQuestion.length
						? clientsForQuestion.join('|')
						: question.client || question.usedIn
						? question.usedIn
								.map((u) => (u && u.client ? u.client.name : null))
								.filter((a) => !!a)
								.join('|')
						: null,
				]);
				// console.log(question.usedIn);
			});
		});
		res.attachment('assessment-topic');
		res.type('text/csv');
		res.send(convertArrayToCSV(rows));
	} catch (e) {
		next(e);
	}
}

export async function getClientStats(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { phases }: { phases?: Types.ObjectId[] } = res.locals;
	const wrapperQuery: FilterQuery<AssessmentWrapperInterface> = {};
	if (phases) {
		wrapperQuery.phases = { phase: { $in: phases || [] } };
	}
	const wrappers: AssessmentWrapperInterface[] = await AssessmentWrapper.find(
		wrapperQuery
	)
		.select('core')
		.populate('core');
	res.send({ wrappers });
}
