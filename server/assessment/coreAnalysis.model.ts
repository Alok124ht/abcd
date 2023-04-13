import { Schema, model } from 'mongoose';
import { map, size } from 'lodash';
import {
	CoreAnalysisInterface,
	CoreAnalysisModelInterface,
	CoreSectionAnalysis,
} from '../types/CoreAnalysis';
import {
	AssessmentCorePopulatedQuestionsInterface,
	QuestionGroup,
} from '../types/AssessmentCore';

const { ObjectId } = Schema.Types;

const CoreAnalysisSchema = new Schema(
	{
		marks: { type: Array, default: [] },
		hist: { type: Array, default: [] },
		sections: [
			{
				id: String,
				questions: [
					{
						id: String,
						sumSqTime: { type: Number, default: 0 },
						sumTime: { type: Number, default: 0 },
						correctAttempts: { type: Number, default: 0 },
						totalAttempts: { type: Number, default: 0 },
						times: {
							type: Array,
							default: [],
						},
					},
				],
				incorrect: { type: Number, default: 0 },
				correct: { type: Number, default: 0 },
				sumMarks: { type: Number, default: 0 },
				maxMarks: { type: Number, default: 0 },
				sumTime: { type: Number, default: 0 },
				marks: { type: Array, default: [] },
				hist: { type: Array, default: [] },
				times: {
					type: Array,
					default: [],
				},
			},
		],
		difficulty: {
			easy: {
				correct: { type: Number, default: 0 },
				incorrect: { type: Number, default: 0 },
				time: { type: Number, default: 0 },
				times: {
					type: Array,
					default: [],
				},
				totalAttempts: { type: Number, default: 0 },
			},
			medium: {
				correct: { type: Number, default: 0 },
				incorrect: { type: Number, default: 0 },
				time: { type: Number, default: 0 },
				times: {
					type: Array,
					default: [],
				},
				totalAttempts: { type: Number, default: 0 },
			},
			hard: {
				correct: { type: Number, default: 0 },
				incorrect: { type: Number, default: 0 },
				time: { type: Number, default: 0 },
				times: {
					type: Array,
					default: [],
				},
				totalAttempts: { type: Number, default: 0 },
			},
		},
		maxMarks: {
			type: Number,
			default: 0,
		},
		sumMarks: {
			type: Number,
			default: 0,
		},
		sumAccuracy: {
			// might not be used now
			type: Number,
			default: 0,
		},
		sumSqAccuracy: {
			// might not be used now
			type: Number,
			default: 0,
		},
		sumPickingAbility: {
			type: Number,
			default: 0,
		},
		sumSqPickingAbility: {
			type: Number,
			default: 0,
		},
		totalAttempts: {
			type: Number,
			default: 0,
		},
		lastSynced: {
			type: Date,
		},
		lastCategorized: {
			type: Date,
			default: Date.now,
		},
		submissions: [
			{
				submission: {
					type: ObjectId,
					ref: 'Submission',
				},
			},
		],
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

const getBestChoiceForQuestionGroup = (
	analysisSection: CoreSectionAnalysis,
	questionGroup: QuestionGroup
) => {
	const optionaQuestionSortedIndexes = [...questionGroup.questions].sort(
		(a, b) => a - b
	);
	const questionListWithData = analysisSection.questions
		.filter((_q, qIndex) => questionGroup.questions.includes(qIndex))
		.map(({ times, correctAttempts, totalAttempts }, index) => {
			return {
				meanTime: times[Math.floor(size(times) / 2)],
				correctAttempts,
				totalAttempts,
				index: optionaQuestionSortedIndexes[index],
			};
		});
	questionListWithData.sort((question1, question2) => {
		const getScore = (q: {
			meanTime: number;
			correctAttempts: number;
			totalAttempts: number;
		}) => {
			const meanTime = q.meanTime || 120;
			const correct = parseInt(q.correctAttempts.toString(), 10);
			const correctAttempts =
				isNaN(correct) || correct < 1 ? 1 : q.correctAttempts;
			const total = parseInt(q.totalAttempts.toString(), 10);
			const totalAttempts = isNaN(total) || total < 1 ? 2 : q.totalAttempts;
			return (totalAttempts / correctAttempts) * meanTime;
		};
		return getScore(question1) - getScore(question2);
	});
	return questionListWithData
		.map((q) => q.index)
		.filter((_qIndex, index) => index < questionGroup.selectNumberOfQuestions);
};
CoreAnalysisSchema.method(
	'getBestQuestionGroupChoices',
	function getBestQuestionGroupChoices(
		this: CoreAnalysisInterface,
		assessmentCore: AssessmentCorePopulatedQuestionsInterface
	): number[][][] {
		const bestChoices = assessmentCore.sections.map((section, sectionIndex) =>
			map(section.questionGroups, (questionGroup) =>
				getBestChoiceForQuestionGroup(this.sections[sectionIndex], questionGroup)
			)
		);
		return bestChoices;
	}
);

const CoreAnalysis = model<CoreAnalysisInterface, CoreAnalysisModelInterface>(
	'CoreAnalysis',
	CoreAnalysisSchema
);
export default CoreAnalysis;
