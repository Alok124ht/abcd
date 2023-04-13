import { every, forEach, isEmpty, reduce, size, some } from 'lodash';
import {
	AssessmentConfig,
	AssessmentSection,
	AssessmentSectionGroup,
} from '../types/AssessmentCore';
import { getSecMaxMarks, getSectionOptionalQuestionCount } from '../lib';

export function generateInstructions(draft: {
	duration: number;
	sections: AssessmentSection[];
	sectionGroups: AssessmentSectionGroup[];
	config: AssessmentConfig;
}) {
	let t = '';
	const hrs = Math.floor(draft.duration / 3600);
	const hrsInSecs = 3600 * hrs;
	const mins = Math.round((draft.duration - hrsInSecs) / 60);
	const minsInSecs = 60 * mins;
	const secs = draft.duration - hrsInSecs - minsInSecs;
	const instructions = [];
	if (hrs) {
		t += `${hrs} hrs`;
	}
	if (mins) {
		t += `${mins} mins`;
	}
	if (secs) {
		t += `${secs} secs`;
	}
	const totalQuestions = reduce(
		draft.sections,
		(n, section) => n + size(section.questions),
		0
	);
	instructions.push({
		type: 'text',
		instruction: `Time allocated for this examination is ${t}`,
		sub_instructions: [],
	});
	const sectionInstructions = draft.sections.map((section, sectionIndex) => {
		const sectionTotalMarks = getSecMaxMarks(section);
		if (size(section.questionGroups) > 0) {
			const optionaQuestionCount = getSectionOptionalQuestionCount(section);
			const totalSectionQuestions = section.questions.length;
			const questionGroupInstructions = section.questionGroups
				.map(
					(
						questionGroup: { questions: any[]; selectNumberOfQuestions: number },
						index: number
					) => {
						let questionOffset = 0;
						draft.sections.forEach((_section, _index) => {
							if (_index < sectionIndex) {
								questionOffset += _section.questions.length;
							}
						});
						const questionList = questionGroup.questions
							.map((questionIndex) => questionOffset + questionIndex + 1)
							.join(', ');
						return `${
							index === 0 ? 'O' : 'o'
						}ut of questions ${questionList} you have to attempt any ${
							questionGroup.selectNumberOfQuestions
						} question${questionGroup.selectNumberOfQuestions > 1 ? 's' : ''}`;
					}
				)
				.join(', ');
			return {
				type: 'text',
				instruction: `Section ${
					section.name
				}: There are total ${totalSectionQuestions} questions in this section. You have to attempt only ${
					totalSectionQuestions - optionaQuestionCount
				} questions. ${questionGroupInstructions}.`,
			};
		}
		return {
			type: 'text',
			instruction: `${section.name} (${section.questions.length} questions - ${sectionTotalMarks} marks)`,
		};
	});
	instructions.push({
		type: 'text',
		instruction: `This paper consists of ${draft.sections.length} section${
			draft.sections.length > 1 ? 's' : ''
		} (${totalQuestions} questions)`,
		sub_instructions: sectionInstructions,
	});
	if (draft.config.extraSections && draft.config.extraSections.length) {
		const questionCountInNonExtraSections = draft.sections.reduce(
			(questionSum, section, index) =>
				draft.config.extraSections.includes(index)
					? questionSum
					: section.questions.length + questionSum,
			0
		);
		const questionCountInExtraSections = draft.sections.reduce(
			(questionSum, section, index) =>
				draft.config.extraSections.includes(index)
					? section.questions.length + questionSum
					: questionSum,
			0
		);
		const numberOfQuestionsInstruction = `If you answer all the ${questionCountInNonExtraSections} questions (without skipping any question), you will have an option of attempting ${questionCountInExtraSections} extra questions, if there is still time left.`;
		instructions.push({
			type: 'text',
			instruction: numberOfQuestionsInstruction,
		});
		const extraQuestionTypeInstruction =
			'These extra questions will be from Physics, Chemistry, and Mathematics/Biology with four questions from each subject.';
		const noCorrectionInstruction = `Also, once you have opted for extra questions, you cannot go back for correction of any of the earlier answered ${questionCountInNonExtraSections} questions`;
		instructions.push({
			type: 'text',
			instruction: extraQuestionTypeInstruction,
		});
		instructions.push({
			type: 'text',
			instruction: noCorrectionInstruction,
		});
	}
	if (
		some(draft.sections, (section) =>
			some(section.questions, (questionItem) => !!questionItem.timeLimit)
		)
	) {
		const everyQuestionHasTimeLimit = every(draft.sections, (section) =>
			every(section.questions, (questionItem) => !!questionItem.timeLimit)
		);
		instructions.push({
			type: 'text',
			instruction: `${
				everyQuestionHasTimeLimit ? 'All ' : 'Some'
			} questions have time limits`,
			sub_instructions: [
				{
					type: 'text',
					instruction:
						'Countdown will be shown for the questions having an upper time limit',
				},
				{
					type: 'text',
					instruction:
						'When time limit is reached, you will automatically be moved to the next question',
				},
			],
		});
	}
	if (size(draft.sectionGroups)) {
		/**
		 * Section groups exists
		 * This is the part where optional sections are mentioned
		 */
		forEach(draft.sectionGroups, (sectionGroup) => {
			if (!isEmpty(sectionGroup) && !isEmpty(sectionGroup)) {
				const { sections, selectionType, selectNumberOfSections } = sectionGroup;
				const selectionTypeText =
					selectionType === 'HIGHEST_SCORE' ? 'highest score' : '';
				if (['HIGHEST_SCORE'].indexOf(selectionType) === -1) {
					throw new Error(`Unknown section selectionType: ${selectionType}`);
				}
				const sectionNames = reduce(
					sections,
					(result, section, index) => {
						const numberToShow = section + 1;
						let itemResult = index === 0 ? '' : ' ';
						itemResult += `${draft.sections[section].name}(#${numberToShow})`;
						if (index === size(sections) - 2) {
							itemResult += ' and';
						} else if (index !== size(sections) - 1) {
							itemResult += ' ,';
						}

						return result + itemResult;
					},
					''
				);
				const instruction = `Out of sections ${sectionNames}, only ${selectNumberOfSections} section${
					selectNumberOfSections > 1 ? 's' : ''
				} with ${selectionTypeText} will be considered.`;
				instructions.push({ type: 'text', instruction, sub_instructions: [] });
			}
		});
	}
	instructions.push({
		type: 'text',
		instruction:
			'When the timer (at top right) reaches zero, the examination will end by itself.',
		sub_instructions: [],
	});
	instructions.push(
		{
			type: 'text',
			instruction:
				'Positive and Negetive marks assosiacted with the questions are displayed at top-right.',
			sub_instructions: [],
		},
		{
			type: 'text',
			instruction: 'Colour-Scheme for question navigation-panel:',
			sub_instructions: [
				{
					type: 'not-visited-icon',
					instruction: 'You have not visited the question yet',
				},
				{
					type: 'not-answered-icon',
					instruction: 'You have not answered the question',
				},
				{ type: 'answered-icon', instruction: 'You have answered the question' },
				{
					type: 'not-answered-marked-icon',
					instruction:
						'You have not answered the question, but have marked it for review',
				},
				{
					type: 'answered-marked-icon',
					instruction: 'You have answered the question, but marked it for review',
				},
			],
		},
		{
			type: 'text',
			instruction:
				'The Marked status for a question simply indicates that you would like to look at that question again. If a question is answered and marked, answer for that question will be considered in evaluation.',
			sub_instructions: [],
		}
	);
	return instructions;
}
