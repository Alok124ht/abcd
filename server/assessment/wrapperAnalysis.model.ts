import mongoose from 'mongoose';
import logger from '../../config/winston';
import { clear as clearCache } from '../cache/WrapperStats';
import Submission from './submission.model';
import CoreAnalyst from '../globals/CoreAnalyst';
import AssessmentCore from './assessmentCore.model';
import {
	WrapperAnalysis,
	WrapperAnalysisModelInterface,
} from '../types/WrapperAnalysis';
import { ISubmission, SubmissionMeta } from 'server/types/Submission';
import { AssessmentCoreInterface } from 'server/types/AssessmentCore';
import { CoreAnalysisInterface } from 'server/types/CoreAnalysis';

const { ObjectId } = mongoose.Schema.Types;

function getAvgQuestionAccuracy(assessment: AssessmentCoreInterface) {
	let sumAccuracy = 0;
	let totalAccuracy = 0;
	assessment.analysis.sections.forEach((section) => {
		section.questions.forEach((question) => {
			sumAccuracy += question.totalAttempts
				? question.correctAttempts / question.totalAttempts
				: 0;
			totalAccuracy += 1;
		});
	});
	return totalAccuracy ? sumAccuracy / totalAccuracy : 0;
}

function getPickingAbility(
	submission: ISubmission,
	assessment: AssessmentCoreInterface
) {
	const threshold = getAvgQuestionAccuracy(assessment);
	let pickingAbility = 0;

	const coreAnalysis = (assessment.analysis as unknown) as CoreAnalysisInterface;
	const { totalAttempts } = coreAnalysis;
	if (totalAttempts < 30) {
		return { pickingAbility: 0 };
	}
	submission.meta.sections.forEach((section, sidx) => {
		section.questions.forEach((question, qidx) => {
			const qA = coreAnalysis.sections[sidx].questions[qidx];
			const qAA = qA.totalAttempts ? qA.correctAttempts / qA.totalAttempts : 0;
			if (qAA > threshold && question.correct === -1) {
				// left easy question
				pickingAbility -= 1;
			} else if (qAA > threshold && question.correct === -1) {
				// left tough question
				pickingAbility += 1;
			}
		});
	});

	return { pickingAbility };
}

const WrapperAnalysisSchema = new mongoose.Schema(
	{
		core: {
			type: ObjectId,
			ref: 'AssessmentCore',
		},
		bonus: {
			type: Object,
			default: {},
		},
		marks: { type: Array, default: [] },
		hist: { type: Array, default: [] },
		topper: Object,
		sections: [
			{
				id: String,
				incorrect: { type: Number, default: 0 },
				correct: { type: Number, default: 0 },
				sumMarks: { type: Number, default: 0 },
				marks: { type: Array, default: [] }, // add userId too!!
				marksWithUser: { type: Array, default: [] },
				sumTime: { type: Number, default: 0 },
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
				totalAttempts: { type: Number, default: 0 },
				times: {
					type: Array,
					default: [],
				},
			},
			medium: {
				correct: { type: Number, default: 0 },
				incorrect: { type: Number, default: 0 },
				time: { type: Number, default: 0 },
				totalAttempts: { type: Number, default: 0 },
				times: {
					type: Array,
					default: [],
				},
			},
			hard: {
				correct: { type: Number, default: 0 },
				incorrect: { type: Number, default: 0 },
				time: { type: Number, default: 0 },
				totalAttempts: { type: Number, default: 0 },
				times: {
					type: Array,
					default: [],
				},
			},
		},
		sumMarks: {
			type: Number,
			default: 0,
		},
		sumAccuracy: {
			type: Number,
			default: 0,
		},
		sumSqAccuracy: {
			type: Number,
			default: 0,
		},
		liveAttempts: {
			type: Number,
			default: 0,
		},
		totalAttempts: {
			type: Number,
			default: 0,
		},
		attemptsSynced: {
			type: Number,
			default: 0,
		},
		submissions: [
			{
				submission: {
					type: ObjectId,
					ref: 'Submission',
				},
			},
		],
		processedAt: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

const shouldUpdateCoreAnalysis = (doc: WrapperAnalysis) => {
	if (!doc.totalAttempts || doc.attemptsSynced >= doc.totalAttempts) {
		return false;
	}
	if (!doc.attemptsSynced) return true;
	if (doc.totalAttempts < 10) return true;
	if (doc.attemptsSynced < 50 && doc.totalAttempts > doc.attemptsSynced + 10) {
		return true;
	}
	if (doc.totalAttempts > doc.attemptsSynced + 20) return true;
	return true;
};

WrapperAnalysisSchema.post('save', (doc: WrapperAnalysis) => {
	if (shouldUpdateCoreAnalysis(doc)) {
		doc.coreAnalysis();
	}
	if (doc.submissions && doc.submissions.length <= 1) {
		logger.error(
			`There is only one submission now in wrapper analysis. Wrapper Analysis ID: ${
				doc._id
			}. ${new Error().stack}`
		);
	}
	try {
		clearCache(doc._id);
	} catch (e) {
		logger.info(`failed to clear cache of  ${doc._id}`);
	}
});

function checkPossibleBugs(meta: SubmissionMeta, maxDuration: number) {
	let sumTime = 0;
	meta.sections.forEach((section) => {
		section.questions.forEach((question) => {
			sumTime += question.time;
		});
	});
	if (sumTime > 1.1 * maxDuration) {
		return false;
	}
	return true;
}

WrapperAnalysisSchema.method(
	'coreAnalysis',
	function coreAnalysis(this: WrapperAnalysis) {
		AssessmentCore.findById(this.core, {
			duration: 1,
			'sections.name': 1,
			'sections.questions.question': 1,
			'sections.questions.correctMark': 1,
			'sections.questions.incorrectMark': 1,
			'sections.questionGroups': 1,
			sectionGroups: 1,
			analysis: 1,
			preAnalysis: 1,
			wrappers: 1,
		})
			.populate([
				{
					path: 'analysis preAnalysis',
				},
				{
					path: 'wrappers.wrapper',
					select: 'analysis',
					populate: [{ path: 'analysis', select: 'attemptsSynced totalAttempts' }],
				},
				{
					path: 'sections.questions.question',
					select:
						'_id type options.isCorrect options._id multiOptions.isCorrect multiOptions._id integerAnswer range level statistics',
					populate: [{ path: 'statistics', select: 'perfectTimeLimits' }],
				},
			])
			.then((assessmentCore) => {
				const coreAnalysis = (assessmentCore.analysis as unknown) as CoreAnalysisInterface;
				const oldSubmissions = coreAnalysis.submissions.map(
					(submission) => submission.submission
				);
				console.log('oldSubmissions');
				console.log(oldSubmissions);
				Submission.find({
					// overlapping??
					assessmentCore: this.core,
					_id: { $nin: oldSubmissions },
					graded: true,
					ignore: { $ne: true },
				}).then((submissions) => {
					submissions.forEach((submission) => {
						const { meta } = submission;
						if (checkPossibleBugs(meta, assessmentCore.duration)) {
							const { pickingAbility } = getPickingAbility(submission, assessmentCore);
							CoreAnalyst.enqueueSubmissionData(
								{
									meta,
									submissionId: submission._id,
									userId: submission.user,
									pickingAbility,
								},
								assessmentCore.analysis._id
							);
						}
					});

					CoreAnalyst.analyseSubmissionData(
						assessmentCore.analysis._id,
						assessmentCore
					);

					assessmentCore.wrappers.forEach((w) => {
						const wrapperAnalysis = w.wrapper.analysis;
						wrapperAnalysis.attemptsSynced = wrapperAnalysis.totalAttempts;
						wrapperAnalysis.markModified('attemptsSynced');
						wrapperAnalysis.save();
					});
				});
			});
	}
);

const WrapperAnalysisModel = mongoose.model<
	WrapperAnalysis,
	WrapperAnalysisModelInterface
>('WrapperAnalysis', WrapperAnalysisSchema);

export default WrapperAnalysisModel;
