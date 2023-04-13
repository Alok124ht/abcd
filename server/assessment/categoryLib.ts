import { Types } from 'mongoose';
import { forEach, get, map } from 'lodash';
import User from '../user/user.model';
import { IUser } from '../user/IUser';
import Usercategory, {
	UserCategory,
	UserCategoryTopic,
} from '../user/usercategory.model';
import Bucket, { IBookmarkedAtByQuestionId } from '../bucket/bucket.model';
import { getDifficulty } from '../question/utils';
import { intentModel } from '../MLModels/intentModel.js';
import { calculateSelectivityForSubmission } from '../utils/user/indexes/selectivity';
import { calculateStaminaForSubmission } from '../utils/user/indexes/stamina';
import { AssessmentCoreInterface } from '../types/AssessmentCore';
import { ISubmission } from '../types/Submission';
import { IQuestion } from '../question/IQuestion';

async function initializeCategory(user: IUser) {
	const usercat = new Usercategory({
		user: user._id,
		assessments: [],
	});
	const savedCategory = await usercat.save();
	await User.update(
		{ _id: user._id },
		{ $set: { category: savedCategory._id } }
	);
	return await Promise.resolve(savedCategory._id);
}

async function initializeCategoryByUserId(userId: string) {
	const usercat = new Usercategory({
		user: userId,
		assessments: [],
	});
	const savedCategory = await usercat.save();
	await User.update({ _id: userId }, { $set: { category: savedCategory._id } });
	return await Promise.resolve(savedCategory._id);
}

function getTooFastQuestions(
	submission: ISubmission,
	assessment: AssessmentCoreInterface
) {
	const tooFastQuestions: { [questionId: string]: boolean } = {};
	const comprehensionTimes: { [questionId: string]: number } = {};
	const comprehensionTooFastTimes: { [questionLinkId: string]: number } = {};
	forEach(get(submission, ['meta', 'sections']), (section, sidx) => {
		section.questions.forEach((question, qidx) => {
			const originalQuestion = (assessment.sections[sidx].questions[qidx]
				.question as unknown) as IQuestion;
			const lTL = originalQuestion.statistics.perfectTimeLimits.min;
			if (originalQuestion.link && originalQuestion.link.id) {
				if (
					comprehensionTooFastTimes[originalQuestion.link.id.toString()] ===
					undefined
				) {
					comprehensionTooFastTimes[originalQuestion.link.id.toString()] = 0;
				}
				comprehensionTooFastTimes[originalQuestion.link.id.toString()] += lTL;
				if (comprehensionTimes[originalQuestion.link.id.toString()] === undefined) {
					comprehensionTimes[originalQuestion.link.id.toString()] = 0;
				}
				comprehensionTimes[originalQuestion.link.id.toString()] += question.time;
			}
		});
	});

	forEach(get(submission, ['meta', 'sections']), (section, sidx) => {
		section.questions.forEach((question, qidx) => {
			const originalQuestion = (assessment.sections[sidx].questions[qidx]
				.question as unknown) as IQuestion;
			const lTL = originalQuestion.statistics.perfectTimeLimits.min;
			if (!originalQuestion.link || !originalQuestion.link.id) {
				if (question.time < lTL) {
					tooFastQuestions[originalQuestion._id] = true;
				}
			} else {
				if (
					comprehensionTimes[originalQuestion.link.id.toString()] <
					comprehensionTooFastTimes[originalQuestion.link.id.toString()]
				) {
					tooFastQuestions[originalQuestion._id] = true;
				}
			}
		});
	});
	return tooFastQuestions;
}

function getTooSlowQuestions(
	submission: ISubmission,
	assessment: AssessmentCoreInterface
) {
	const tooSlowQuestions: { [questionId: string]: boolean } = {};
	const comprehensionTimes: { [questionId: string]: number } = {};
	const comprehensionTooFastTimes: { [questionLinkId: string]: number } = {};
	forEach(get(submission, ['meta', 'sections']), (section, sidx) => {
		section.questions.forEach((question, qidx) => {
			const originalQuestion = (assessment.sections[sidx].questions[qidx]
				.question as unknown) as IQuestion;
			const uTL = originalQuestion.statistics.perfectTimeLimits.max;
			if (originalQuestion.link && originalQuestion.link.id) {
				if (
					comprehensionTooFastTimes[originalQuestion.link.id.toString()] ===
					undefined
				) {
					comprehensionTooFastTimes[originalQuestion.link.id.toString()] = 0;
				}
				comprehensionTooFastTimes[originalQuestion.link.id.toString()] += uTL;
				if (comprehensionTimes[originalQuestion.link.id.toString()] === undefined) {
					comprehensionTimes[originalQuestion.link.id.toString()] = 0;
				}
				comprehensionTimes[originalQuestion.link.id.toString()] += question.time;
			}
		});
	});

	forEach(get(submission, ['meta', 'sections']), (section, sidx) => {
		section.questions.forEach((question, qidx) => {
			const originalQuestion = (assessment.sections[sidx].questions[qidx]
				.question as unknown) as IQuestion;
			const uTL = originalQuestion.statistics.perfectTimeLimits.max;
			if (!originalQuestion.link || !originalQuestion.link.id) {
				if (question.time > uTL) {
					tooSlowQuestions[originalQuestion._id] = true;
				}
			} else {
				if (
					comprehensionTimes[originalQuestion.link.id.toString()] >
					comprehensionTooFastTimes[originalQuestion.link.id.toString()]
				) {
					tooSlowQuestions[originalQuestion._id] = true;
				}
			}
		});
	});
	return tooSlowQuestions;
}

function getBluffsData(
	submission: ISubmission,
	assessment: AssessmentCoreInterface
) {
	let correctBluffs = 0;
	let corrects = 0;
	let totalTooFastAttempts = 0;
	let totalAttempts = 0;
	const toofastQuestions = getTooFastQuestions(submission, assessment);
	forEach(get(submission, ['meta', 'sections']), (section, sidx) => {
		section.questions.forEach((question, qidx) => {
			const originalQuestion = (assessment.sections[sidx].questions[qidx]
				.question as unknown) as IQuestion;
			if (question.correct === 1) {
				if (toofastQuestions[originalQuestion._id]) {
					correctBluffs += 1;
				}
				corrects += 1;
			}
			if (question.correct !== -1) {
				if (toofastQuestions[originalQuestion._id]) {
					totalTooFastAttempts += 1;
				}
				totalAttempts += 1;
			}
		});
	});
	return { correctBluffs, corrects, totalTooFastAttempts, totalAttempts };
}

function getTimeLostData(
	submission: ISubmission,
	assessment: AssessmentCoreInterface
) {
	let maxIdleTime = 0;
	let totalTimeTaken = 0;
	forEach(get(submission, ['meta', 'sections']), (section) => {
		section.questions.forEach((question) => {
			totalTimeTaken += question.time;
		});
	});
	submission.flow.forEach((f) => {
		if (
			f.section < assessment.sections.length &&
			f.question < assessment.sections[f.section].questions.length
		) {
			const uTL =
				assessment.sections[f.section].questions[f.question].question.statistics
					.perfectTimeLimits.max;
			const idleTime = Math.max(0, f.time / 1000.0 - uTL);
			maxIdleTime = Math.max(maxIdleTime, idleTime);
		}
	});
	const earlyExitTime = Math.max(0, assessment.duration - totalTimeTaken);
	return { maxIdleTime, earlyExitTime };
}

///

function updateOvertimeQuestions(
	intimes: any[],
	overtimes: any[],
	userId: IUser | string
) {
	const userId_ = typeof userId === 'object' ? userId._id : userId;

	Bucket.findOne({ user: userId_ }).then((bucket) => {
		if (bucket) {
			const d = new Date();
			const babq = bucket.bookmarkedAtByQuestionId;
			let found = false;
			const overtimeMap: IBookmarkedAtByQuestionId = {};
			bucket.buckets.forEach((b) => {
				b.questions.forEach((q) => {
					overtimeMap[q.toHexString()] = babq && babq[q] ? babq[q] : d;
				});
				if (b.name === 'Overtime' && b.default) {
					found = true;

					overtimes.forEach((q) => {
						overtimeMap[q] = d;
					});
					intimes.forEach((q) => {
						delete overtimeMap[q]; // possible bug!!
					});
					b.questions = Object.keys(overtimeMap).map((k) => Types.ObjectId(k));
				}
			});
			bucket.bookmarkedAtByQuestionId = overtimeMap;
			if (!found) {
				bucket.buckets.push({
					name: 'Overtime',
					color: '#f4ce56',
					default: true,
					questions: overtimes,
				});
			}
			bucket.markModified('buckets');
			bucket.markModified('bookmarkedAtByQuestionId');
			bucket.save();
		} else {
			// create
		}
	});
}

///

function getEndurance(
	submission: ISubmission,
	assessment: AssessmentCoreInterface
) {
	// a = number of correct questions in time
	// b = number of questions not in time
	// returns a / (a + b)
	let correctsInTime = 0;
	let allNotInTime = 0;
	const tooSlowQuestions = getTooSlowQuestions(submission, assessment);
	const overtimes: Types.ObjectId[] = [];
	const intimes: Types.ObjectId[] = [];
	forEach(get(submission, ['meta', 'sections']), (section, sidx) => {
		section.questions.forEach((question, qidx) => {
			const originalQuestion = (assessment.sections[sidx].questions[qidx]
				.question as unknown) as IQuestion;
			if (!tooSlowQuestions[originalQuestion._id] && question.correct === 1) {
				correctsInTime += 1;
				intimes.push(originalQuestion._id);
			} else if (tooSlowQuestions[originalQuestion._id]) {
				allNotInTime += 1;
				overtimes.push(originalQuestion._id);
			}
		});
	});
	updateOvertimeQuestions(intimes, overtimes, submission.user);
	return { correctsInTime, allNotInTime };
}

function getQuestionsStuckOn(
	submission: ISubmission,
	assessment: AssessmentCoreInterface
) {
	// if time spend > 2 * uTL, he stuck on that question

	const tooSlowQuestions: { [questionId: string]: boolean } = {};
	const tooSlowQuestionTimes: { [questionId: string]: number } = {};
	const comprehensionTimes: { [linkId: string]: number } = {};
	const comprehensionTooFastTimes: { [link: string]: number } = {};
	forEach(get(submission, ['meta', 'sections']), (section, sidx) => {
		section.questions.forEach((question, qidx) => {
			const originalQuestion = (assessment.sections[sidx].questions[qidx]
				.question as unknown) as IQuestion;
			const uTL = originalQuestion.statistics.perfectTimeLimits.max;
			if (originalQuestion.link && originalQuestion.link.id) {
				if (
					comprehensionTooFastTimes[originalQuestion.link.id.toString()] ===
					undefined
				) {
					comprehensionTooFastTimes[originalQuestion.link.id.toString()] = 0;
				}
				comprehensionTooFastTimes[originalQuestion.link.id.toString()] += uTL;
				if (comprehensionTimes[originalQuestion.link.id.toString()] === undefined) {
					comprehensionTimes[originalQuestion.link.id.toString()] = 0;
				}
				comprehensionTimes[originalQuestion.link.id.toString()] += question.time;
			}
		});
	});

	forEach(get(submission, ['meta', 'sections']), (section, sidx) => {
		section.questions.forEach((question, qidx) => {
			const originalQuestion = (assessment.sections[sidx].questions[qidx]
				.question as unknown) as IQuestion;
			const uTL = originalQuestion.statistics.perfectTimeLimits.max;
			if (!originalQuestion.link || !originalQuestion.link.id) {
				// if (submission._id.toString() === '5e3457b602bd2b78b9fce4c1') {
				// console.log('check question', sidx, qidx, question.time, 1.25 * uTL);
				// }
				if (question.time > 1.25 * uTL) {
					tooSlowQuestions[originalQuestion._id] = true;
					tooSlowQuestionTimes[originalQuestion._id] = (question.time - uTL) / uTL;
				}
			} else {
				const uTime = comprehensionTimes[originalQuestion.link.id.toString()];
				const cUTL = comprehensionTooFastTimes[originalQuestion.link.id.toString()];
				if (uTime > 1.25 * cUTL) {
					tooSlowQuestions[originalQuestion._id] = true;
					tooSlowQuestionTimes[originalQuestion._id] = (uTime - cUTL) / cUTL;
				}
			}
		});
	});
	return {
		questionsStuckOn: Object.keys(tooSlowQuestions).length,
		tooSlowQuestionTimes,
	};
}

function getTwoByThreeMat(
	assessment: AssessmentCoreInterface,
	submission: ISubmission
) {
	type SubTopicPerformance = {
		[topic: string]: {
			'correct-too-fast'?: number;
			'correct-optimum'?: number;
			'correct-too-slow'?: number;
			'incorrect-too-fast'?: number;
			'incorrect-optimum'?: number;
			'incorrect-too-slow'?: number;
			unattempted?: number;
		};
	};
	const sTopics: {
		[topic: string]: {
			subTopics?: SubTopicPerformance;
			'correct-too-fast'?: number;
			'correct-optimum'?: number;
			'correct-too-slow'?: number;
			'incorrect-too-fast'?: number;
			'incorrect-optimum'?: number;
			'incorrect-too-slow'?: number;
			unattempted?: number;
		};
	} = {};
	forEach(assessment.sections, (s) => {
		s.questions.forEach((q) => {
			const question = (q.question as unknown) as IQuestion;
			if (sTopics[question.topic] === undefined) {
				const subTopics: SubTopicPerformance = {};
				subTopics[question.sub_topic] = {
					'correct-too-fast': 0,
					'correct-optimum': 0,
					'correct-too-slow': 0,
					'incorrect-too-fast': 0,
					'incorrect-optimum': 0,
					'incorrect-too-slow': 0,
					unattempted: 0,
				};

				sTopics[question.topic] = {
					'correct-too-fast': 0,
					'correct-optimum': 0,
					'correct-too-slow': 0,
					'incorrect-too-fast': 0,
					'incorrect-optimum': 0,
					'incorrect-too-slow': 0,
					unattempted: 0,
					subTopics,
				};
			} else if (
				sTopics[question.topic].subTopics[q.question.topic] === undefined
			) {
				sTopics[question.topic].subTopics[q.question.sub_topic] = {
					'correct-too-fast': 0,
					'correct-optimum': 0,
					'correct-too-slow': 0,
					'incorrect-too-fast': 0,
					'incorrect-optimum': 0,
					'incorrect-too-slow': 0,
					unattempted: 0,
				};
			}
		});
	});

	const difficulty = {
		easy: {
			'correct-too-fast': 0,
			'correct-optimum': 0,
			'correct-too-slow': 0,
			'incorrect-too-fast': 0,
			'incorrect-optimum': 0,
			'incorrect-too-slow': 0,
			unattempted: 0,
		},
		medium: {
			'correct-too-fast': 0,
			'correct-optimum': 0,
			'correct-too-slow': 0,
			'incorrect-too-fast': 0,
			'incorrect-optimum': 0,
			'incorrect-too-slow': 0,
			unattempted: 0,
		},
		hard: {
			'correct-too-fast': 0,
			'correct-optimum': 0,
			'correct-too-slow': 0,
			'incorrect-too-fast': 0,
			'incorrect-optimum': 0,
			'incorrect-too-slow': 0,
			unattempted: 0,
		},
	};

	forEach(get(submission, ['meta', 'sections']), (section, sIdx) => {
		section.questions.forEach((question, qIdx) => {
			if (question.correct === 0 || question.correct === 1) {
				const qq = (assessment.sections[sIdx].questions[qIdx]
					.question as unknown) as IQuestion;
				const q =
					assessment.sections[sIdx].questions[qIdx].question.statistics
						.perfectTimeLimits;
				let timeScore = 1;
				if (q.min !== undefined) {
					if (question.time < q.min) timeScore = 0;
					else if (question.time > q.max) {
						timeScore = 2;
					}
				}

				const d = getDifficulty(qq);

				if (question.correct === 1) {
					if (timeScore === 0) {
						sTopics[qq.topic]['correct-too-fast'] += 1;
						sTopics[qq.topic].subTopics[qq.sub_topic]['correct-too-fast'] += 1;
						difficulty[d]['correct-too-fast'] += 1;
					} else if (timeScore === 1) {
						sTopics[qq.topic]['correct-optimum'] += 1;
						sTopics[qq.topic].subTopics[qq.sub_topic]['correct-optimum'] += 1;
						difficulty[d]['correct-optimum'] += 1;
					} else {
						sTopics[qq.topic]['correct-too-slow'] += 1;
						sTopics[qq.topic].subTopics[qq.sub_topic]['correct-too-slow'] += 1;
						difficulty[d]['correct-too-slow'] += 1;
					}
				} else {
					if (timeScore === 0) {
						sTopics[qq.topic]['incorrect-too-fast'] += 1;
						sTopics[qq.topic].subTopics[qq.sub_topic]['incorrect-too-fast'] += 1;
						difficulty[d]['incorrect-too-fast'] += 1;
					} else if (timeScore === 1) {
						sTopics[qq.topic]['incorrect-optimum'] += 1;
						sTopics[qq.topic].subTopics[qq.sub_topic]['incorrect-optimum'] += 1;
						difficulty[d]['incorrect-optimum'] += 1;
					} else {
						sTopics[qq.topic]['incorrect-too-slow'] += 1;
						sTopics[qq.topic].subTopics[qq.sub_topic]['incorrect-too-slow'] += 1;
						difficulty[d]['incorrect-too-slow'] += 1;
					}
				}
			} else {
				const qq = (assessment.sections[sIdx].questions[qIdx]
					.question as unknown) as IQuestion;
				const d = getDifficulty(qq);
				sTopics[qq.topic]['unattempted'] += 1;
				sTopics[qq.topic].subTopics[qq.sub_topic]['unattempted'] += 1;
				difficulty[d]['unattempted'] += 1;
			}
		});
	});
	const topics = map(sTopics, (value, key) => {
		return {
			id: key,
			'correct-too-fast': value['correct-too-fast'],
			'correct-optimum': value['correct-optimum'],
			'correct-too-slow': value['correct-too-slow'],
			'incorrect-too-fast': value['incorrect-too-fast'],
			'incorrect-optimum': value['incorrect-optimum'],
			'incorrect-too-slow': value['incorrect-too-slow'],
			unattempted: value['unattempted'],
			subTopics: map(value.subTopics, (subTopicPerfValue, subTopicId) => {
				return {
					id: subTopicId,
					'correct-too-fast': subTopicPerfValue['correct-too-fast'],
					'correct-optimum': subTopicPerfValue['correct-optimum'],
					'correct-too-slow': subTopicPerfValue['correct-too-slow'],
					'incorrect-too-fast': subTopicPerfValue['incorrect-too-fast'],
					'incorrect-optimum': subTopicPerfValue['incorrect-optimum'],
					'incorrect-too-slow': subTopicPerfValue['incorrect-too-slow'],
					unattempted: subTopicPerfValue['unattempted'],
				};
			}),
		};
	});

	return { topics, difficulty };
}

function getActivityPatches(
	submission: ISubmission,
	assessmentCore: AssessmentCoreInterface
) {
	const patches: { activity: number; duration: number }[] = [];
	for (let i = 0; i < assessmentCore.duration / 240.0; i++) {
		patches.push({ activity: 0, duration: 240 });
	}
	let currentTime = 0;
	const lastResponse: { [sectionQuestionId: string]: any } = {};
	submission.flow.forEach((f) => {
		currentTime += f.time / 1000.0;
		const currentPatch = Math.min(
			patches.length - 1,
			Math.max(0, Math.round(currentTime / 240))
		);
		if (f.response && f.response !== lastResponse[`${f.section}-${f.question}`]) {
			patches[currentPatch].activity += 1;
		}
		lastResponse[`${f.section}-${f.question}`] = f.response;
	});
	return patches;
}

function getAssessmentProps(assessmentCore: AssessmentCoreInterface) {
	const { duration } = assessmentCore;
	let totalQuestions = 0;
	assessmentCore.sections.forEach((section) => {
		totalQuestions += section.questions.length;
	});
	return { duration, totalQuestions };
}

function updateCategory(
	category: UserCategory,
	assessmentCore: AssessmentCoreInterface,
	submission: ISubmission
) {
	//manage multiple wrappers of same assessmentCore, and same user

	const {
		correctBluffs,
		corrects,
		totalTooFastAttempts,
		totalAttempts,
	} = getBluffsData(submission, assessmentCore);

	const { maxIdleTime, earlyExitTime } = getTimeLostData(
		submission,
		assessmentCore
	);

	const { correctsInTime, allNotInTime } = getEndurance(
		submission,
		assessmentCore
	);

	const selectivity = calculateSelectivityForSubmission(
		submission,
		assessmentCore
	);

	const stamina = calculateStaminaForSubmission(submission, assessmentCore);

	// console.log('check stamina of users', stamina);
	const { questionsStuckOn, tooSlowQuestionTimes } = getQuestionsStuckOn(
		submission,
		assessmentCore
	);

	const { duration, totalQuestions } = getAssessmentProps(assessmentCore);

	let found = -1;
	category.assessments.forEach((a, idx) => {
		if (a.assessment.toString() == submission.assessmentWrapper._id.toString())
			found = idx; // should be wrapper id
	});

	const matData = getTwoByThreeMat(assessmentCore, submission);
	const patches = getActivityPatches(submission, assessmentCore);

	if (found === -1) {
		const updateData = {
			assessment: submission.assessmentWrapper._id, // could be an issue
			topics: matData.topics,
			correctBluffs,
			corrects,
			totalTooFastAttempts,
			totalAttempts,
			maxIdleTime,
			earlyExitTime,
			correctsInTime,
			allNotInTime,
			selectivity,
			stamina,
			questionsStuckOn,
			patches,
			tooSlowQuestionTimes,
			duration,
			totalQuestions,
			version: 4,
		};

		Usercategory.update(
			{ _id: category._id },
			{ $push: { assessments: updateData } }
		).exec();
	} else {
		const updateData = {};

		updateData[`assessments.${found}.topics`] = matData.topics;
		updateData[`assessments.${found}.correctBluffs`] = correctBluffs;
		updateData[`assessments.${found}.corrects`] = corrects;
		updateData[
			`assessments.${found}.totalTooFastAttempts`
		] = totalTooFastAttempts;
		updateData[`assessments.${found}.totalAttempts`] = totalAttempts;
		updateData[`assessments.${found}.maxIdleTime`] = maxIdleTime;
		updateData[`assessments.${found}.earlyExitTime`] = earlyExitTime;
		updateData[`assessments.${found}.correctsInTime`] = correctsInTime;
		updateData[`assessments.${found}.allNotInTime`] = allNotInTime;
		updateData[`assessments.${found}.selectivity`] = selectivity; //we would need avgPickingAbilityToo. save it in ass ana
		updateData[`assessments.${found}.stamina`] = stamina; //we would need avgPickingAbilityToo. save it in ass ana
		updateData[`assessments.${found}.questionsStuckOn`] = questionsStuckOn;
		updateData[`assessments.${found}.patches`] = patches;
		updateData[
			`assessments.${found}.tooSlowQuestionTimes`
		] = tooSlowQuestionTimes;
		updateData[`assessments.${found}.duration`] = duration;
		updateData[`assessments.${found}.totalQuestions`] = totalQuestions;
		updateData[`assessments.${found}.version`] = 4;

		Usercategory.update({ _id: category._id }, { $set: updateData }).exec();
	}
}

function getTopicIndex(topics: { id: string }[], topicId: string): number {
	let idx = -1;
	topics.forEach((topic, i) => {
		if (topic.id === topicId) idx = i;
	});
	return idx;
}

function addAvgData(category: UserCategory) {
	if (!category) {
		return null;
	}
	let correctBluffs = 0;
	let corrects = 0;
	let totalTooFastAttempts = 0;
	let totalAttempts = 0;
	let maxIdleTime = 0;
	let earlyExitTime = 0;
	let correctsInTime = 0;
	let allNotInTime = 0;
	let questionsStuckOn = 0;
	let totalQuestions = 0;
	let duration = 0;
	let totalAssessments = 0;
	let selectivity = 0;
	let stamina = 0;
	const topics: UserCategoryTopic[] = [];
	if (category.assessments) {
		category.assessments.forEach((assessment) => {
			if (assessment.version === 4) {
				const d = assessment.duration;
				const aTotalQuestions = assessment.totalQuestions; //total questions in assessment
				correctBluffs += assessment.correctBluffs;
				corrects += assessment.corrects;
				totalTooFastAttempts += assessment.totalTooFastAttempts;
				totalAttempts += assessment.totalAttempts;
				maxIdleTime += Math.min(assessment.maxIdleTime, d); //get duration
				earlyExitTime += assessment.earlyExitTime;
				correctsInTime += assessment.correctsInTime;
				allNotInTime += assessment.allNotInTime;
				if (assessment.tooSlowQuestionTimes) {
					let sum_ = 0;
					Object.keys(assessment.tooSlowQuestionTimes).forEach((k) => {
						sum_ += Math.min(assessment.tooSlowQuestionTimes[k], 2);
					});
					questionsStuckOn += sum_;
				} else {
					questionsStuckOn += assessment.questionsStuckOn;
				}

				totalQuestions += aTotalQuestions;
				duration += d; //save this in category!

				selectivity += assessment.selectivity;
				stamina += assessment.stamina;
				if (assessment.patches) {
					let emptyPatches = 0;
					assessment.patches.forEach((p) => {
						if (p.activity === 0) emptyPatches += 1;
					});
				}

				assessment.topics.forEach((topic) => {
					let idx1 = getTopicIndex(topics, topic.id);
					if (idx1 === -1) {
						topics.push({
							id: topic.id,
							'correct-too-fast': 0,
							'correct-optimum': 0,
							'correct-too-slow': 0,
							'incorrect-too-fast': 0,
							'incorrect-optimum': 0,
							'incorrect-too-slow': 0,
							unattempted: 0,
							subTopics: [],
						});
						idx1 = topics.length - 1;
					}
					topics[idx1]['correct-too-fast'] += topic['correct-too-fast'];
					topics[idx1]['correct-optimum'] += topic['correct-optimum'];
					topics[idx1]['correct-too-slow'] += topic['correct-too-slow'];
					topics[idx1]['incorrect-too-fast'] += topic['incorrect-too-fast'];
					topics[idx1]['incorrect-optimum'] += topic['incorrect-optimum'];
					topics[idx1]['incorrect-too-slow'] += topic['incorrect-too-slow'];
					topics[idx1]['unattempted'] += topic['unattempted'];
					topic.subTopics.forEach((subTopic) => {
						let idx2 = getTopicIndex(topics[idx1].subTopics, subTopic.id);
						if (idx2 === -1) {
							topics[idx1].subTopics.push({
								id: subTopic.id,
								'correct-too-fast': 0,
								'correct-optimum': 0,
								'correct-too-slow': 0,
								'incorrect-too-fast': 0,
								'incorrect-optimum': 0,
								'incorrect-too-slow': 0,
								unattempted: 0,
							});
							idx2 = topics[idx1].subTopics.length - 1;
						}
						topics[idx1].subTopics[idx2]['correct-too-fast'] +=
							subTopic['correct-too-fast'];
						topics[idx1].subTopics[idx2]['correct-optimum'] +=
							subTopic['correct-optimum'];
						topics[idx1].subTopics[idx2]['correct-too-slow'] +=
							subTopic['correct-too-slow'];
						topics[idx1].subTopics[idx2]['incorrect-too-fast'] +=
							subTopic['incorrect-too-fast'];
						topics[idx1].subTopics[idx2]['incorrect-optimum'] +=
							subTopic['incorrect-optimum'];
						topics[idx1].subTopics[idx2]['incorrect-too-slow'] +=
							subTopic['incorrect-too-slow'];
						topics[idx1].subTopics[idx2]['unattempted'] += subTopic['unattempted'];
					});
				});
				totalAssessments += 1;
			}
		});
	}

	let bluff1 = false;
	let bluff2 = false;
	let bluff3 = false;
	let bluff4 = false;
	let bluff5 = false;
	let endurance = 0;
	let stubborness = 0;
	let intent = 0;
	let cAssigned = 0;

	if (correctBluffs >= 0.4 * corrects) {
		// all good
		bluff1 = true;
		// cAssigned = 1;
	}
	if (totalTooFastAttempts >= 0.4 * totalAttempts) {
		// all good
		bluff2 = true;
		// cAssigned = 1;
	}
	if (totalAttempts <= 0.2 * totalQuestions || totalAttempts <= 3) {
		// all good
		bluff3 = true;
		// cAssigned = 1;
	}
	if (maxIdleTime >= Math.max(600, 0.1 * duration)) {
		// all good
		bluff4 = true;
		// cAssigned = 1;
	}
	if (earlyExitTime >= 0.3 * duration) {
		// all good
		bluff5 = true;
		// cAssigned = 1;
	}
	if (correctsInTime + allNotInTime) {
		// all good
		endurance = (100.0 * correctsInTime) / (correctsInTime + allNotInTime);
	}

	// stamina = (100.0 * totalAttempts) / totalQuestions; // all good

	let dFactor = 0;
	if (corrects) {
		intent += (100.0 * correctBluffs) / corrects;
		dFactor += 1;
	}

	if (totalQuestions) {
		// get totalQuestions
		intent += 100 - (100.0 * totalAttempts) / totalQuestions;
		dFactor += 1;
	}

	if (duration) {
		// get duration
		intent += (100.0 * maxIdleTime) / duration;
		dFactor += 1;
	}

	if (duration) {
		// get duration
		intent += (100.0 * earlyExitTime) / duration;
		dFactor += 1;
	}

	if (dFactor) {
		intent = intent / dFactor;
	}

	intent = 100 - intent;

	const percent_attempt = (1.0 * totalAttempts) / totalQuestions;
	const percent_early_exit = (1.0 * earlyExitTime) / duration;
	const percent_guesses = totalAttempts
		? (1.0 * totalTooFastAttempts) / totalAttempts
		: 1;
	const percent_idle =
		duration - earlyExitTime > 0
			? (1.0 * maxIdleTime) / (duration - earlyExitTime)
			: 1;

	intent = Math.max(
		0,
		Math.min(
			100,
			100 *
				intentModel([
					percent_attempt,
					percent_early_exit,
					percent_guesses,
					percent_idle,
				])[0]
		)
	);

	if (intent < 60) {
		cAssigned = 1;
	}

	if (totalAssessments) {
		stamina /= totalAssessments;
		selectivity /= totalAssessments;
	}
	stubborness = (100.0 * questionsStuckOn) / totalAttempts;

	if (intent < 60) {
		const defaultEndurance2 = 70;
		const defaultStubbornness2 = 70;
		const defaultStamina2 = 70;
		const defaultSelectivity2 = 70;
		endurance = 0.8 * defaultEndurance2 + 0.2 * endurance;
		stubborness = 100 - (0.8 * defaultStubbornness2 + 0.2 * (100 - stubborness));
		stamina = 0.8 * defaultStamina2 + 0.2 * stamina;
		selectivity = 0.8 * defaultSelectivity2 + 0.2 * selectivity;
	}

	if (!cAssigned && endurance < 60) {
		cAssigned = 2;
	}
	if (!cAssigned && selectivity < 60) {
		cAssigned = 3;
	}
	if (!cAssigned && stubborness >= 40) {
		cAssigned = 4;
	}
	if (!cAssigned && stamina < 60) {
		cAssigned = 5;
	}
	if (!cAssigned) {
		cAssigned = 6;
	}

	const newCategory = {
		bluff1,
		bluff2,
		bluff3,
		bluff4,
		bluff5,
		cAssigned,
		endurance,
		pickingAbility: selectivity,
		stubborness,
		intent,
		stamina,
		topics,
		totalAssessments,
	};

	return newCategory;
}

module.exports = {
	initializeCategoryByUserId,
	initializeCategory,
	updateCategory,
	getActivityPatches,
	getQuestionsStuckOn,
	addAvgData,
};
