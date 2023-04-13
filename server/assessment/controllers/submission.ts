import { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { Request } from '../../types/Request';
import AssessmentWrapperCache from '../../cache/AssessmentWrapper';
import AssessmentCoreCache from '../../cache/AssessmentCore';
import WrapperAnalysisCache from '../../cache/WrapperAnalysis';
import UserLiveAssessmentCache from '../../cache/UserLiveAssessment';
import CoreAnalysisCache from '../../cache/CoreAnalysis';
import UserCache from '../../cache/User';
import UserLiveAssessment from '../../user/UserLiveAssessment';
import Submission from '../submission.model';
import WrapperAnalyst from '../../globals/WrapperAnalyst';
import { getTotalQuestions, isAnswerCorrect } from '../../lib';
import { getRanking } from '../lib';
import { AssessmentWrapperInterface } from '../../types/AssessmentWrapper';
import {
	AssessmentCoreInterface,
	AssessmentSection,
} from '../../types/AssessmentCore';
import { CoreAnalysisInterface } from '../../types/CoreAnalysis';
import { IUser } from '../../user/IUser';
import logger from '../../../config/winston';
import { getUserAgentFromRequest } from '../../utils/request';
import FlowLog from '../../log/flowlog.model';
import {
	gradeSubmissionUpdateAssessment,
	gradeAllSections,
	gradeSubmission,
} from '../gradeLib';
import { FlowItem, ISubmission } from '../../types/Submission';
import { getActivePhasesFromSubscriptions } from '../../utils/phase';
import { IQuestion } from 'server/question/IQuestion';
import { WrapperAnalysis } from 'server/types/WrapperAnalysis';
import { isAtLeastModerator } from '../../utils/user/role';
import UserModel from '../../user/user.model';
import AssessmentWrapper from '../assessmentWrapper.model';
import { forEach, get, isArray, split, toString, toUpper } from 'lodash';
import { ignoredRoutes } from 'express-winston';
import WrapperAnalysisModel from '../wrapperAnalysis.model';
import CoreAnalysis from '../coreAnalysis.model';

function setQuestionTime(
	flow: FlowItem[],
	response: { sections: any[] },
	useFlow?: boolean
) {
	// if flow works fine, get answers from flow only!!
	response.sections.forEach((s) => {
		s.questions.forEach((q: { time: number }) => {
			q.time = 0;
		});
	});
	flow.forEach((f) => {
		if (f.section < response.sections.length) {
			if (f.question < response.sections[f.section].questions.length) {
				response.sections[f.section].questions[f.question].time += f.time;

				if (useFlow) {
					response.sections[f.section].questions[f.question].answer = f.response;
				}
			}
		}
	});
	return response;
}

function getFirstSeenTime(flow: any[], n: number) {
	const questionsSeen: { [sectionQuestionIndex: string]: any } = {};
	let sumTime = 0;

	flow.forEach((f) => {
		if (questionsSeen[`${f.section}-${f.question}`] === undefined) {
			questionsSeen[`${f.section}-${f.question}`] = f.response;
		}
		if (Object.keys(questionsSeen).length < n) {
			sumTime += f.time;
		}
	});

	if (Object.keys(questionsSeen).length < n) sumTime = -1;
	return sumTime;
}

function getResponseTimeCategory(
	response: { time: number },
	question: IQuestion
) {
	// confirm this from saharan
	let category = 'perfect';

	const q = question.statistics.perfectTimeLimits;

	if (q && q.min !== undefined) {
		if (response.time / 1000.0 < q.min) category = 'wasted';
		else if (response.time / 1000.0 > q.max) category = 'overtime';
	}
	return category;
}

function getFirstTimeAccuracy(sections: AssessmentSection[], flow: any[]) {
	const firstTimeAnswers: { [sectionQuestionIndex: string]: any } = {};
	const firstTimeActions: { [sectionQuestionIndex: string]: any } = {};
	let firstSeenCorrect = 0;
	let firstSeenIncorrect = 0;
	let firstSeenSkip = 0;

	flow.forEach((f) => {
		if (
			f.response !== undefined &&
			firstTimeActions[`${f.section}-${f.question}`] === undefined
		) {
			if (f.response === null) {
				firstSeenSkip += 1;
			} else if (
				isAnswerCorrect(
					f.response,
					sections[f.section].questions[f.question].question
				)
			) {
				firstSeenCorrect += 1;
			} else {
				firstSeenIncorrect += 1;
			}
			firstTimeActions[`${f.section}-${f.question}`] = f.response;
		}

		if (
			f.response &&
			firstTimeAnswers[`${f.section}-${f.question}`] === undefined
		) {
			firstTimeAnswers[`${f.section}-${f.question}`] = f.response;
		}
	});

	let correct = 0;
	let incorrect = 0;
	Object.keys(firstTimeAnswers).forEach((k) => {
		const s: string = k.split('-')[0];
		const q = k.split('-')[1];
		if (isAnswerCorrect(firstTimeAnswers[k], sections[s].questions[q].question)) {
			correct += 1;
		} else incorrect += 1;
	});

	return {
		correct,
		incorrect,
		firstSeenCorrect,
		firstSeenIncorrect,
		firstSeenSkip,
	};
}

function getFreshGradedStats(
	submission: ISubmission,
	assessmentCore: AssessmentCoreInterface,
	wrapperAnalysis: WrapperAnalysis,
	coreAnalysis: CoreAnalysisInterface
) {
	const {
		meta: { percent, percentile, rank, marks, sections },
		flow,
	} = submission;
	const ranks = getRanking(wrapperAnalysis, marks);
	if (
		percent !== ranks.percent ||
		percentile !== ranks.percentile ||
		rank !== ranks.rank
	) {
		// for auto graded only!!
		submission.meta.percent = ranks.percent;
		submission.meta.percentile = ranks.percentile;
		submission.meta.rank = ranks.rank;
	}

	const submissionCopy: {
		meta: any;
		response: any;
		flow: any;
		graded: boolean;
		live: boolean;
		_id: Types.ObjectId;
		roadmap?: any;
	} = {
		meta: submission.meta,
		response: submission.response,
		flow: submission.flow,
		graded: submission.graded,
		live: submission.live,
		_id: submission._id,
	};

	const timeQuestionMap: { [questionId: string]: any } = {};

	let currentTime = 0;
	let questionsSeen = 0;
	const intermediatePoints: {
		firstVisit: number;
		lastVisit: number;
		timeCategory: string;
		timeToughness: number;
		topic: number;
		result: number;
		questionsSeen: number;
		questionsAttempted: number;
		time: number;
		totalTime: number;
		accuracy: string;
		sectionName: string;
		questionNo: number;
		totalVisits: number;
		difficulty: number;
	}[] = [];
	let questionsAttempted = 0;
	const lastResponse: { [questionId: string]: any } = {};

	let offset = 0;
	const questionOffsets = assessmentCore.sections.map((s) => {
		const lastOffset = offset;
		offset += s.questions.length;
		return lastOffset;
	});

	flow.forEach((flowItem: FlowItem) => {
		let skip = false;
		if (assessmentCore.sections[flowItem.section] === undefined) skip = true;
		else if (
			assessmentCore.sections[flowItem.section].questions[flowItem.question] ===
			undefined
		) {
			skip = true;
		}
		if (!skip) {
			const question = assessmentCore.sections[flowItem.section].questions[
				flowItem.question
			].question as unknown as IQuestion;
			const questionStats =
				coreAnalysis.sections[flowItem.section].questions[flowItem.question];
			// store question correct Attempts, sum time, etc etc
			const metaQuestion =
				submissionCopy.meta.sections[flowItem.section].questions[flowItem.question];
			const questionResponse =
				submissionCopy.response.sections[flowItem.section].questions[
					flowItem.question
				];

			let modifcation = false;
			if (lastResponse[question._id] !== flowItem.response) modifcation = true;
			lastResponse[question._id] = flowItem.response;

			if (timeQuestionMap[question._id] === undefined) {
				let timeToughness = 180;

				if (flowItem.state === 3 || flowItem.state === 4) questionsAttempted += 1;

				if (question.statistics.medianTime) {
					timeToughness = question.statistics.medianTime;
				} else if (questionStats.correctAttempts > 0) {
					timeToughness = questionStats.sumTime / questionStats.correctAttempts;
				}
				let result = 0;
				if (questionResponse.answer) {
					if (metaQuestion.correct) {
						result = 1;
					} else {
						result = -1;
					}
				}

				let accuracy = 'N/A';
				if (questionStats.totalAttempts) {
					accuracy = `${Math.round(
						(100.0 * questionStats.correctAttempts) / questionStats.totalAttempts
					)}%`;
				}
				questionsSeen += 1;

				timeQuestionMap[question._id] = {
					firstVisit: currentTime,
					lastVisit: currentTime + flowItem.time,
					timeCategory: getResponseTimeCategory(questionResponse, question),
					timeToughness,
					topic: question.topic,
					result,
					questionsSeen,
					questionsAttempted,
					time: currentTime,
					totalTime: metaQuestion.time,
					accuracy,
					sectionName: assessmentCore.sections[flowItem.section].name,
					questionNo: questionOffsets[flowItem.section] + flowItem.question + 1,
					totalVisits: 1,
					difficulty: question.level,
				};
			} else {
				// intermediatePoints

				intermediatePoints.push({
					firstVisit: -1,
					lastVisit: -1,
					timeCategory: 'perfect',
					timeToughness: -1,
					topic: -1,
					result: -1,
					questionsSeen,
					questionsAttempted,
					time: currentTime,
					totalTime: -1,
					accuracy: '',
					sectionName: '',
					questionNo: -1,
					totalVisits: -1,
					difficulty: -1,
				});
				if (modifcation) {
					timeQuestionMap[question._id].lastVisit = currentTime + flowItem.time;
				}
				timeQuestionMap[question._id].totalVisits += 1;
			}
			currentTime += flowItem.time; // millisecs
		}
	});

	const roadmap: typeof intermediatePoints = Object.keys(timeQuestionMap).map(
		(k) => ({
			firstVisit: timeQuestionMap[k].firstVisit,
			_id: k,
			timeToughness: timeQuestionMap[k].timeToughness,
			timeCategory: timeQuestionMap[k].timeCategory,
			topic: timeQuestionMap[k].topic,
			result: timeQuestionMap[k].result,
			lastVisit: timeQuestionMap[k].lastVisit,
			questionsSeen: timeQuestionMap[k].questionsSeen,
			questionsAttempted: timeQuestionMap[k].questionsAttempted,
			time: timeQuestionMap[k].firstVisit,
			totalTime: timeQuestionMap[k].totalTime,
			accuracy: timeQuestionMap[k].accuracy,
			sectionName: timeQuestionMap[k].sectionName,
			questionNo: timeQuestionMap[k].questionNo,
			totalVisits: timeQuestionMap[k].totalVisits,
			difficulty: timeQuestionMap[k].difficulty,
		})
	);

	intermediatePoints.forEach((ip) => {
		roadmap.push(ip);
	});

	submissionCopy.roadmap = roadmap;

	const firstSeenTime = getFirstSeenTime(
		submission.flow,
		getTotalQuestions(assessmentCore)
	);

	const { firstSeenCorrect, firstSeenIncorrect, firstSeenSkip } =
		getFirstTimeAccuracy(assessmentCore.sections, submission.flow);

	// eslint-disable-next-line no-param-reassign
	submission.meta.firstSeenTime = firstSeenTime;
	// eslint-disable-next-line no-param-reassign
	submission.meta.firstSeenCorrect = firstSeenCorrect;
	// eslint-disable-next-line no-param-reassign
	submission.meta.firstSeenIncorrect = firstSeenIncorrect;
	// eslint-disable-next-line no-param-reassign
	submission.meta.firstSeenSkip = firstSeenSkip;

	delete submissionCopy.flow;

	return { submission: submissionCopy };
}

export function submitAssessmentResponse(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const {
		assessmentId: assessmentWrapperId,
		sEvent,
		useFlow,
		submitFor,
		flow: flowFromRequest,
	} = req.body;
	const { response } = res.locals;
	const { role } = req.payload;
	logger.info('role : ' + role);

	const isAdminSubmitting = isAtLeastModerator(role) && submitFor;
	const userId = isAdminSubmitting ? submitFor : req.payload.id;

	logger.info('userId : ' + role);

	logger.info(req.body);

	logger.info(
		`${
			isAdminSubmitting ? `Admin Submitting: AdminID: ${req.payload.id};` : ''
		}user: ${userId}, api: assessment${
			req.url
		},user-agent: ${getUserAgentFromRequest(req)}, time: ${new Date()}`
	);

	let maintainedFlow = [];
	if (isAdminSubmitting) {
	}

	AssessmentWrapperCache.get(
		assessmentWrapperId,
		(err1: Error, assessmentWrapper: AssessmentWrapperInterface) => {
			console.log('here wrapper cache');
			if (err1) {
				next(err1);
				return;
			}
			AssessmentCoreCache.getWithSolution(
				assessmentWrapper.core,
				(err2: Error, assessmentCore: AssessmentCoreInterface) => {
					console.log('here core cache');

					if (err2) {
						next(err2);
						return;
					}
					WrapperAnalysisCache.get(
						assessmentWrapper.analysis,
						(err3: Error, wrapperAnalysis: WrapperAnalysis) => {
							console.log('here analysis cache');

							if (err3) {
								next(err3);
								return;
							}
							CoreAnalysisCache.get(
								assessmentCore.analysis,
								(err4: Error, coreAnalysis: CoreAnalysisInterface) => {
									console.log('here core analysis cache');

									UserCache.getWithLiveAssessment(userId, (err: Error, user: IUser) => {
										try {
											const flow = isAdminSubmitting
												? flowFromRequest
												: user.liveAssessment.flow;
											const assessmentWrapperId = isAdminSubmitting
												? assessmentWrapper._id
												: user.liveAssessment.assessmentWrapperId;
											const submission = new Submission();
											// assumption- analysis models are already created!!
											submission.assessmentWrapper = assessmentWrapper._id;
											submission.assessmentCore = assessmentWrapper.core;
											submission.wrapperAnalysis = assessmentWrapper.analysis;
											submission.coreAnalysis = assessmentCore.analysis; // this is remaining!
											submission.user = userId;
											submission.response = setQuestionTime(flow, response, useFlow);
											submission.originalResponse = response;
											submission.flow = flow;
											submission.version = 2;
											submission.sEvent = sEvent;
											if (isAdminSubmitting) {
												submission.submittedBy = Types.ObjectId(req.payload.id);
											}

											// admin can re-submit
											let hasAlreadySubmitted = isAdminSubmitting ? false : true;

											logger.info('is Admin Submitting : ' + isAdminSubmitting);

											if (
												!isAdminSubmitting &&
												user.liveAssessment &&
												assessmentWrapperId
											) {
												logger.info(
													'!isAdminSubmitting && user.liveAssessment && assessmentWrapperId'
												);
												hasAlreadySubmitted = false;
												UserLiveAssessment.update(
													{ user: userId },
													{
														$set: {
															assessmentWrapperId: null,
															startTime: null,
															duration: 0,
															flow: [],
														},
													}
												).then(() => {
													UserLiveAssessmentCache.set(
														userId,
														{
															assessmentWrapperId: null,
															startTime: null,
															duration: 0,
															flow: [],
														},
														() => {}
													);
												});
											}

											if (
												!hasAlreadySubmitted &&
												(assessmentWrapper.type !== 'LIVE-TEST' || assessmentWrapper.graded)
											) {
												// or when assessment is graded??
												logger.info(
													"!hasAlreadySubmitted && (assessmentWrapper.type !== 'LIVE-TEST' || assessmentWrapper.graded)"
												);
												const meta = gradeSubmissionUpdateAssessment(
													// set graded = true in submission, live or not, and meta too
													// need to optimize this alone now!
													assessmentWrapper,
													assessmentCore,
													wrapperAnalysis,
													coreAnalysis,
													submission,
													getActivePhasesFromSubscriptions(user.subscriptions),
													assessmentWrapper.type
												);

												submission.meta = meta;
												submission.graded = true;
												submission.live = false;
												submission
													.save()
													.then((savedSubmission) => {
														if (!isAdminSubmitting) {
															UserLiveAssessment.update(
																{ user: userId },
																{
																	$set: {
																		assessmentWrapperId: null,
																		startTime: null,
																		duration: 0,
																		flow: [],
																	},
																}
															).then(() => {
																UserLiveAssessmentCache.set(
																	userId,
																	{
																		assessmentWrapperId: null,
																		startTime: null,
																		duration: 0,
																		flow: [],
																	},
																	() => {}
																);
															});
														}
														WrapperAnalyst.enqueueSubmissionData(
															{
																meta,
																submissionId: savedSubmission._id,
																userId: submission.user,
															},
															wrapperAnalysis._id
														);

														const savedSubmissionWithStats = getFreshGradedStats(
															savedSubmission,
															assessmentCore,
															wrapperAnalysis,
															coreAnalysis
														);
														res.json({
															success: true,
															submission: savedSubmissionWithStats.submission,
															submissionId: savedSubmission._id,
															// times: [t1 - t0, t2 - t1, t3 - t2, t4 - t3, t5 - t4],
														});
													})
													.catch((saveError) => {
														// eslint-disable-next-line no-console
														console.log('check err', saveError);
														res.status(422).send({
															success: true,
															message: 'Can not submit your response.',
														});
													});
											} else if (!hasAlreadySubmitted) {
												logger.info('!isAlreadySubmitted');
												submission
													.save()
													.then((savedSubmission) => {
														if (!isAdminSubmitting) {
															UserLiveAssessment.update(
																{ user: userId },
																{
																	$set: {
																		assessmentWrapperId: null,
																		startTime: null,
																		duration: 0,
																		flow: [],
																	},
																}
															).then(() => {
																UserLiveAssessmentCache.set(
																	userId,
																	{
																		assessmentWrapperId: null,
																		startTime: null,
																		duration: 0,
																		flow: [],
																	},
																	() => {}
																);
															});
														}
														const meta = gradeAllSections(
															savedSubmission.response.sections,
															assessmentCore.sections,
															{},
															assessmentCore.markingScheme,
															assessmentCore.sectionGroups
														);
														savedSubmission.meta = meta;

														res.send({
															success: true,
															message: 'Your response have been saved successfully.',
															submission: savedSubmission,
															submissionId: savedSubmission._id,
														});
													})
													.catch((saveError) => {
														logger.error(
															`Error saving submission: ${
																typeof saveError === 'string' ? saveError : saveError.message
															}`
														);
														res.status(422).send({
															success: true,
															message: 'Can not submit your response.',
														});
													});
											} else {
												logger.info({ payload: req.payload, body: req.body });
												res.status(422).send({
													success: true,
													user,
													message: 'Can not submit your response. Already submitted!',
												});
											}
										} catch (err) {
											console.log({ err });
										}
									});
								}
							);
						}
					);
				}
			);
		}
	);
}

export async function createSubmissionFromFlow(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { userId, wrapperId, skipFromEnd = 0, mock } = req.body;
	try {
		const flowLogs = await FlowLog.find({ user: userId, wrapperId });
		const flow: FlowItem[] = [];
		let totalItems = 0;

		flowLogs.forEach((flowLog) => {
			flowLog.flow.forEach(() => {
				totalItems += 1;
			});
		});
		let itemsPushed = 0;
		flowLogs.forEach((flowLog) => {
			flowLog.flow.forEach((flowItem) => {
				if (totalItems - itemsPushed < skipFromEnd) {
					return;
				}
				flow.push(flowItem);
				itemsPushed += 1;
			});
		});
		const assessmentWrapper: AssessmentWrapperInterface = await new Promise(
			(resolve, reject) =>
				AssessmentWrapperCache.get(
					wrapperId,
					(error: Error, wrapper: AssessmentWrapperInterface) => {
						if (error) {
							reject(error);
						} else {
							resolve(wrapper);
						}
					}
				)
		);
		const assessmentCore: AssessmentCoreInterface = await new Promise(
			(resolve, reject) => {
				AssessmentCoreCache.getWithSolution(
					assessmentWrapper.core,
					(err: Error, assessmentCore: AssessmentCoreInterface) => {
						if (err) {
							reject(err);
						} else {
							resolve(assessmentCore);
						}
					}
				);
			}
		);

		const response: { sections: any[] } = { sections: [] };
		assessmentCore.sections.forEach((section) => {
			const questions = section.questions.map(() => ({ time: 0 }));
			response.sections.push({ questions });
		});

		const submission = new Submission();
		// assumption- analysis models are already created!!
		submission.assessmentWrapper = assessmentWrapper._id;
		submission.assessmentCore = assessmentWrapper.core as unknown as string;
		submission.wrapperAnalysis = assessmentWrapper.analysis;
		submission.coreAnalysis = assessmentCore.analysis; // this is remaining!
		submission.user = userId;
		submission.response = setQuestionTime(flow, response, true);
		submission.originalResponse = response;
		submission.flow = flow;
		submission.version = 2;
		submission.set('sEvent', 'recovery');
		/** Mock means dry run recovery */
		if (!mock) {
			await submission.save();
		}
		res.send({ submission, flow, flowLogs });
	} catch (e) {
		next(e);
	}
}

const charObject = {
	A: 0,
	B: 1,
	C: 2,
	D: 3,
	E: 4,
	F: 5,
	G: 6,
	H: 7,
	I: 8,
	J: 9,
	K: 10,
	L: 11,
	M: 12,
	N: 13,
	O: 14,
	P: 15,
	Q: 16,
	R: 17,
	S: 18,
	T: 19,
	U: 20,
	V: 21,
	W: 22,
	X: 23,
	Y: 24,
	Z: 25,
};

const createFlowFromRawData = (
	flow: any[],
	duration: number,
	sections: any[]
) => {
	const newFlow: any[] = [];
	let i = 0;
	forEach(sections, (sec, secIndex) => {
		forEach(sec.questions, (ques, queIndex) => {
			let flowAnswer: string | string[] | null = null;

			if (
				[
					'MULTIPLE_CHOICE_SINGLE_CORRECT',
					'LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT',
					'MULTIPLE_CHOICE_MULTIPLE_CORRECT',
					'LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT',
				].includes(ques.question.type)
			) {
				let optionsArray: any[] = [];
				if (ques.question.options && ques.question.options.length > 0) {
					optionsArray = ques.question.options;
				} else if (
					ques.question.multiOptions &&
					ques.question.multiOptions.length > 0
				) {
					optionsArray = ques.question.multiOptions;
				}
				const splittedAnswer = split(flow[i], ',');
				if (!splittedAnswer || splittedAnswer.length === 0) {
					flowAnswer = null;
				} else {
					if (
						[
							'MULTIPLE_CHOICE_SINGLE_CORRECT',
							'LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT',
						].includes(ques.question.type)
					) {
						if (splittedAnswer[0] && splittedAnswer[0] !== 'x') {
							const index = get(charObject, `${toUpper(splittedAnswer[0])}`, null);
							if (index !== null) {
								flowAnswer = get(optionsArray[index], '_id', null);
							}
						}
					} else {
						flowAnswer = [];
						forEach(splittedAnswer, (arr) => {
							if (arr !== 'x') {
								const index = get(charObject, `${toUpper(arr)}`, null);
								if (index) {
									// @ts-ignore
									flowAnswer.push(get(optionsArray[index], '_id', null));
								}
							}
						});
					}
				}
			} else {
				flowAnswer = flow[i] && flow[i] !== 'x' ? flow[i] : null;
			}
			newFlow.push({
				section: secIndex,
				question: queIndex,
				response: flowAnswer,
				time: duration * 1000,
				state:
					!flowAnswer || (isArray(flowAnswer) && flowAnswer.length === 0) ? 2 : 1,
			});
			i++;
		});
	});
	return newFlow;
};

const findQuestionFromFlow = (
	flow: any[],
	section: number,
	question: number
) => {
	let found: any = false;
	for (var i = 0; i < flow.length; i++) {
		if (flow[i].section === section && flow[i].question === question) {
			found = flow[i];
		}
	}
	return found;
};

const convertFlowToSections = (flow: any[], coreSections: any[]) => {
	const sections: any[] = [];

	coreSections?.forEach((sec, secIndex) => {
		let obj: any = {
			// @ts-ignore
			name: sec.name,
			total_questions: sec.questions.length,
			questions: [],
		};
		sec.questions.forEach((que, questionIndex) => {
			const found = findQuestionFromFlow(flow, secIndex, questionIndex);
			if (!found) {
				obj.questions.push({
					time: 0,
					answer: null,
					state: 0,
				});
			} else {
				obj.questions.push({
					time: found.time,
					answer: found.response,
					state: found.state,
				});
			}
		});
		sections.push(obj);
	});
	return sections;
};

export const uploadCbtResponse = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id } = req.payload;
		const { flow, submitFor, wrapper } = req.body;

		logger.info('api called');

		const dbUser = await UserModel.findById(submitFor);

		const userPhases = getActivePhasesFromSubscriptions(dbUser.subscriptions);

		const dbWrapper = await AssessmentWrapper.findById(wrapper).populate([
			{
				path: 'analysis',
			},
			{
				path: 'core',
				populate: [
					{ path: 'analysis' },
					{ path: 'sections.questions.question', model: 'Question' },
				],
			},
		]);

		if (!dbWrapper) {
			res.send({ success: false, msg: 'Wrapper not found' });
			return;
		}

		let totalQues = 0;
		forEach(dbWrapper.core.sections, (sec) => {
			forEach(sec.questions, (ques) => {
				totalQues += 1;
			});
		});

		if (totalQues === 0) {
			totalQues = 50;
		}

		const convertedFlow = createFlowFromRawData(
			flow,
			dbWrapper.core.duration / totalQues,
			dbWrapper.core.sections
		);

		const sections = convertFlowToSections(
			convertedFlow,
			dbWrapper.core.sections
		);

		const newSubmission = new Submission();
		newSubmission.user = submitFor;
		newSubmission.assessmentWrapper = wrapper;
		// @ts-ignore
		newSubmission.assessmentCore = dbWrapper.core._id;
		// @ts-ignore
		newSubmission.wrapperAnalysis = dbWrapper.analysis._id;
		// @ts-ignore
		newSubmission.coreAnalysis = dbWrapper.core.analysis._id;
		newSubmission.response = { sections };
		newSubmission.originalResponse = { sections };
		newSubmission.graded = dbWrapper.graded;
		newSubmission.live = true;
		newSubmission.version = 2;
		newSubmission.isCategorized = true;
		newSubmission.attemptsUpdated = false;
		newSubmission.ignore = false;
		newSubmission.submittedBy = id;
		newSubmission.flow = convertedFlow;
		newSubmission.sEvent = 'user';

		if (dbWrapper.graded) {
			// @ts-ignore
			newSubmission.meta = gradeSubmission(
				newSubmission,
				dbWrapper.core,
				// @ts-ignore
				dbWrapper.analysis.bonus,
				0,
				userPhases,
				dbWrapper.phases,
				dbWrapper.type
			);
		}

		newSubmission.save((err, saved) => {
			if (saved) {
				WrapperAnalyst.enqueueSubmissionData(
					{
						meta: newSubmission.meta,
						submissionId: saved._id,
						userId: newSubmission.user,
					},
					// @ts-ignore
					dbWrapper.analysis._id
				);
				res.send({
					success: true,
					msg: 'Assessment uploaded',
				});
			} else {
				res.send({
					success: false,
					msg: 'Failed to upload',
				});
			}
		});
	} catch (err) {
		res.send({
			success: false,
			msg: 'Parsing error',
			err: err.message,
		});
	}
};

export const appendSubmissionsToAnalysis = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { submission } = req.params;
	const dbSubmission = await Submission.findById(submission);

	if (dbSubmission) {
		const wrapperAnalysis = await WrapperAnalysisModel.findById(
			dbSubmission.wrapperAnalysis
		);
		const coreAnalysis = await CoreAnalysis.findById(dbSubmission.coreAnalysis);

		let successes = {
			wrapperAnalysis: false,
			coreAnalysis: false,
		};
		if (wrapperAnalysis) {
			let found = false;
			forEach(wrapperAnalysis.submissions, (submissions) => {
				if (toString(submissions.submission) === submission) {
					found = true;
				}
			});
			if (!found) {
				await WrapperAnalysisModel.updateOne(
					{ _id: dbSubmission.wrapperAnalysis },
					{ $push: { submissions: { submission: Types.ObjectId(submission) } } }
				).then((updated) => {
					if (updated) {
						successes.wrapperAnalysis = true;
					}
				});
			}
		}
		if (coreAnalysis) {
			let found = false;
			forEach(coreAnalysis.submissions, (submissions) => {
				if (toString(submissions.submission) === submission) {
					found = true;
				}
			});
			if (!found) {
				await CoreAnalysis.updateOne(
					{ _id: dbSubmission.coreAnalysis },
					{ $push: { submissions: { submission: Types.ObjectId(submission) } } }
				).then((updated) => {
					if (updated) {
						successes.coreAnalysis = true;
					}
				});
			}
		}

		let msg = 'Done Submitting';

		if (successes.coreAnalysis) {
			msg += ', Added to core Analysis';
		}
		if (successes.wrapperAnalysis) {
			msg += ', Added to wrapper Analysis';
		}

		res.send({ success: true, msg });
	} else {
		res.send({ success: false, msg: 'Submission not found' });
	}
};
