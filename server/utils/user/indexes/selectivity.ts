import { filter, forEach, reduce, map } from 'lodash';

enum SelectivityColor {
	RED = 'red',
	GREEN = 'green',
}

interface FlowItem {
	id: number;
	section: number;
	question: number;
	time: number;
	action: number;
	state: number;
	response: any;
}
interface Submission {
	flow: FlowItem[];
}

interface TransformedFlowItem {
	_id: number;
	timeSpent: number;
	isAnswered: boolean;
	section: number;
	wasAnsweredEarlier: number;
	question: string;
}

interface Section {
	name: string;
	questions: any[];
}

interface Assessment {
	sections: Section[];
	duration: number;
}

interface Question {
	_id: string;
	perfectTimeLimits: {
		tooSlow: number;
		tooFast: number;
		decision: number;
	};
	medianTime: number;
	avgAccuracy: number;
	color?: SelectivityColor;
}

interface QuestionsById {
	[index: string]: Question;
}

interface Color {
	key: SelectivityColor;
	nonSelectivityFactor: number;
}

interface ColorByKey {
	[key: string]: Color;
}

interface Meta {
	colors: Color[];
	questions: QuestionsById;
}

interface CompareFnParam {
	avgAccuracy1: number;
	avgAccuracy2: number;
	medianTime1: number;
	medianTime2: number;
	timePerQuestion: number;
}

const isResponseNonEmpty = (response: any) => !!response || response === 0;

function getEffectiveDecisionTimeRemaining(
	questionId: string,
	items: TransformedFlowItem[],
	decisionTime: number,
	tooSlowTime: number
) {
	const timeSpent = items.reduce((accumulator, item) => {
		if (item.question === questionId) {
			return accumulator + item.timeSpent;
		}
		return accumulator;
	}, 0);
	let effectiveDecisionTimeRemaining = 0;
	if (timeSpent < decisionTime) {
		effectiveDecisionTimeRemaining = decisionTime - timeSpent;
	}
	const effectiveTooSlowTimeRemaining = Math.max(tooSlowTime - timeSpent, 0);
	return [effectiveDecisionTimeRemaining, effectiveTooSlowTimeRemaining];
}

function mapEffectiveRemainingQuestion(
	i: TransformedFlowItem,
	ii: number,
	questions: QuestionsById,
	items: TransformedFlowItem[]
) {
	const questionI = questions[i.question];
	const {
		perfectTimeLimits: { tooSlow: tooSlowTimeI, decision: decisionTimeI },
	} = questionI;
	const [
		effectiveDecisionTimeRemainingI,
		effectiveTooSlowTimeRemainingI,
	] = getEffectiveDecisionTimeRemaining(
		i.question,
		items.slice(0, ii),
		decisionTimeI,
		tooSlowTimeI
	);
	if (i.timeSpent < effectiveDecisionTimeRemainingI) {
		return { question: i.question, v: 1 };
	} else if (i.timeSpent > effectiveTooSlowTimeRemainingI) {
		return { question: i.question, v: 0 };
	} else if (i.isAnswered || i.wasAnsweredEarlier) {
		return { question: i.question, v: 0 };
	}
	return {
		question: i.question,
		v:
			Math.max(i.timeSpent - effectiveDecisionTimeRemainingI, 0) /
			(tooSlowTimeI - decisionTimeI),
	};
}

function getSelectivityIndexForAssessmentSubmission(
	items: TransformedFlowItem[],
	meta: Meta
) {
	let nonSelectivity = 0;
	const questions = meta.questions;
	const nr =
		filter(questions, (i) => i.color === SelectivityColor.RED).length || 1;
	const ng =
		filter(questions, (i) => i.color === SelectivityColor.GREEN).length || 1;
	const colorsByKey: ColorByKey = {};
	meta.colors.forEach((color) => {
		colorsByKey[color.key] = color;
	});
	items.forEach((item, index) => {
		const { timeSpent } = item;
		const question = questions[item.question];
		if (!question) {
			return;
		}
		const {
			_id: id,
			perfectTimeLimits: {
				tooSlow: tooSlowTime,
				decision: decisionTime,
				tooFast: tooFastTime,
			},
			color: colorKey,
		} = question;
		const nonSelectivityFactor = colorsByKey[colorKey].nonSelectivityFactor;
		if (!nonSelectivityFactor) {
			/** it will not contribute to nonSelectivity
			 **for example: if nonSelectivityValue is 0 for green brick
			 **it will not contribute to lower selectivity
			 */
			return;
		}
		let wastedTime;
		const [
			effectiveDecisionTimeRemaining,
			effectiveTooSlowTimeRemaining,
		] = getEffectiveDecisionTimeRemaining(
			id,
			items.slice(0, index),
			decisionTime,
			tooSlowTime
		);
		if (timeSpent < effectiveDecisionTimeRemaining) {
			wastedTime = 0;
		} else {
			wastedTime = timeSpent - effectiveDecisionTimeRemaining;
		}
		if (wastedTime > effectiveTooSlowTimeRemaining) {
			wastedTime = effectiveTooSlowTimeRemaining;
		}
		const effectiveQuestionsRemaining: { [key: string]: number } = {};
		forEach(questions, ({ _id, color }) => {
			if (color === SelectivityColor.GREEN) {
				effectiveQuestionsRemaining[_id] = 1;
			}
		});
		items
			.slice(0, index)
			.filter(
				(i) =>
					questions[i.question] &&
					questions[i.question].color === SelectivityColor.GREEN
			)
			.map((i, ii) => mapEffectiveRemainingQuestion(i, ii, questions, items))
			.forEach(({ question: q, v }) => {
				effectiveQuestionsRemaining[q] = v;
			});
		const ngr = reduce(
			effectiveQuestionsRemaining,
			(accumulator, value) => accumulator + value,
			0
		);
		const maximumTimeCanSpend = tooSlowTime - tooFastTime;
		const nonSelectivityContribution =
			(nonSelectivityFactor *
				(Math.min(1, wastedTime / maximumTimeCanSpend) * ngr)) /
			ng;
		console.assert(
			nonSelectivityContribution >= 0,
			'nonSelectivityContribution>=0',
			nonSelectivityContribution,
			ng,
			maximumTimeCanSpend
		);
		nonSelectivity += nonSelectivityContribution;
	});
	const nonSelectivityNormalized = nonSelectivity / nr;
	return Math.round(100 * (1 - nonSelectivityNormalized));
}

function getDefaultAndScaledAvgAccuracyIfNotSetAnd(
	avgAccuracy: number
): number {
	if (!avgAccuracy) {
		return 0.5;
	}
	return avgAccuracy / 100;
}

function getDefaultMedianTimeIfNotSet(
	medianTime: number,
	timePerQuestion: number
) {
	if (!medianTime) {
		return timePerQuestion;
	}
	return medianTime;
}

function shouldReturnZero({
	avgAccuracy1,
	avgAccuracy2,
	medianTime1,
	medianTime2,
	timePerQuestion,
}: CompareFnParam): boolean {
	if (
		Math.abs(avgAccuracy1 - avgAccuracy2) < 0.1 &&
		Math.abs(medianTime1 - medianTime2) < 0.1 * timePerQuestion
	) {
		return true;
	}
	return false;
}

function shouldReturnNegative({
	avgAccuracy1,
	avgAccuracy2,
	medianTime1,
	medianTime2,
	timePerQuestion,
}: CompareFnParam) {
	const probabilityOfSolvingInTime1 = Math.min(1, medianTime1 / timePerQuestion);
	const probabilityOfSolvingInTime2 = Math.min(1, medianTime2 / timePerQuestion);
	const probabilityOfSolving1 = avgAccuracy1 * probabilityOfSolvingInTime1;
	const probabilityOfSolving2 = avgAccuracy2 * probabilityOfSolvingInTime2;
	return probabilityOfSolving1 > probabilityOfSolving2;
}

const colorQuestions = (
	questionList: Question[],
	totalTime: number
): QuestionsById => {
	const timePerQuestion = totalTime / questionList.length;
	const sortedQuestionList = questionList.map((q) => q);
	sortedQuestionList.sort((question1, question2) => {
		let { avgAccuracy: avgAccuracy1, medianTime: medianTime1 } = question1;
		let { avgAccuracy: avgAccuracy2, medianTime: medianTime2 } = question2;
		avgAccuracy1 = getDefaultAndScaledAvgAccuracyIfNotSetAnd(avgAccuracy1);
		avgAccuracy2 = getDefaultAndScaledAvgAccuracyIfNotSetAnd(avgAccuracy2);
		medianTime1 = getDefaultMedianTimeIfNotSet(medianTime1, timePerQuestion);
		medianTime2 = getDefaultMedianTimeIfNotSet(medianTime2, timePerQuestion);

		if (
			shouldReturnZero({
				avgAccuracy1,
				avgAccuracy2,
				medianTime1,
				medianTime2,
				timePerQuestion,
			})
		) {
			return 0;
		}
		if (
			shouldReturnNegative({
				avgAccuracy1,
				avgAccuracy2,
				medianTime1,
				medianTime2,
				timePerQuestion,
			})
		) {
			return 1;
		}
		return 1;
	});
	const coloredQuestions: QuestionsById = {};
	let redQuestionCount = 0;
	sortedQuestionList.reduce((accumulator, q, index) => {
		let color = SelectivityColor.GREEN;
		if (
			accumulator > totalTime ||
			(redQuestionCount < sortedQuestionList.length / 10 &&
				index > (90 * sortedQuestionList.length) / 100)
		) {
			color = SelectivityColor.RED;
			redQuestionCount = +1;
		}
		coloredQuestions[q._id] = { ...q, color };
		return accumulator + q.medianTime;
	}, 0);
	return coloredQuestions;
};

const transformFlowToItems = (flow: FlowItem[]) =>
	flow.map((f, index) => ({
		_id: f.question,
		timeSpent: Math.floor(f.time / 1000),
		isAnswered: !!f.response,
		question: f.question,
		section: f.section,
		wasAnsweredEarlier: flow
			.slice(0, index)
			.filter(
				(ff) => ff.question === f.question && isResponseNonEmpty(ff.response)
			).length,
	}));

const getProcessedAndColoredData = (assessment: Assessment) => {
	const assessmentQuestionsById: QuestionsById = {};
	if (!assessment || !assessment.sections) {
		return 0;
	}

	assessment.sections.forEach((section) => {
		section.questions.forEach((questionItem) => {
			assessmentQuestionsById[questionItem.question._id] = {
				perfectTimeLimits: {
					tooSlow: questionItem.question.statistics.perfectTimeLimits.max,
					tooFast: questionItem.question.statistics.perfectTimeLimits.min,
					decision: questionItem.question.statistics.perfectTimeLimits.min,
				},
				medianTime: questionItem.question.statistics.medianTime,
				avgAccuracy: questionItem.question.statistics.avgAccuracy,
				_id: questionItem.question._id,
			};
		});
	});

	const meta: Meta = {
		colors: [
			{ key: SelectivityColor.GREEN, nonSelectivityFactor: 0 },
			{ key: SelectivityColor.RED, nonSelectivityFactor: 1 },
		],
		questions: colorQuestions(map(assessmentQuestionsById), assessment.duration),
	};
	return meta;
};

export function calculateSelectivityForSubmission(
	submission: Submission,
	assessment: Assessment
) {
	const processedAndColoredData = getProcessedAndColoredData(assessment);
	if (processedAndColoredData === 0) {
		return 0;
	}
	const assessmentQuestionIds: string[] = [];
	assessment.sections.forEach((section) => {
		section.questions.forEach((questionItem) => {
			assessmentQuestionIds.push(questionItem.question._id);
		});
	});
	const getQuestionIndex = (questionNumber: number, sectionNumber: number) => {
		let questionsInPrevSections = 0;
		assessment.sections.forEach((section, index) => {
			if (index < sectionNumber) {
				questionsInPrevSections += section.questions.length;
			}
		});
		return questionsInPrevSections + questionNumber;
	};

	const itemsFromFlow: TransformedFlowItem[] = transformFlowToItems(
		submission.flow
	).map((fl) => ({
		...fl,
		_id: fl.question,
		question: assessmentQuestionIds[getQuestionIndex(fl.question, fl.section)],
	}));
	return getSelectivityIndexForAssessmentSubmission(
		itemsFromFlow,
		processedAndColoredData
	);
}
