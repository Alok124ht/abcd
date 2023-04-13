import { Schema, Types, model, FilterQuery } from 'mongoose';
import {
	AssessmentCoreInterface,
	AssessmentCoreModelInterface,
	QuestionGroupSelectionType,
} from '../types/AssessmentCore';
import AssessmentWrapper from './assessmentWrapper.model';

const ObjectId = Schema.Types.ObjectId;

const AssessmentCoreSchema = new Schema(
	{
		identifier: {
			type: String,
		},
		instructions: {
			type: Array,
		},
		customInstructions: [{ type: String }],
		sectionInstructions: [
			{
				text: String,
				markingScheme: [
					{
						text: String,
					},
				],
			},
		],
		syllabus: {
			topics: [
				{
					id: String,
					subTopics: [
						{
							id: String,
						},
					],
				},
			],
		},
		customSyllabus: [{ name: String, subTopics: [{ name: String }] }],
		duration: {
			type: Number,
		},
		sections: [
			{
				name: String,
				subject: String,
				duration: {
					type: Number,
					default: -1,
				},
				/**
				 * User has to answer only {selectNumberOfQuestions} questions
				 * out of {questions.length} questions,
				 * if answered more than {selectNumberOfQuestions},
				 * first {selectNumberOfQuestions} questions will be considered for grading
				 */
				questionGroups: [
					{
						questions: [{ type: Number }],
						selectionType: {
							type: String,
							enum: [QuestionGroupSelectionType.PickFromStart],
						},
						selectNumberOfQuestions: { type: Number },
					},
				],
				questions: [
					{
						question: {
							type: ObjectId,
							ref: 'Question',
						},
						topic: String,
						sub_topic: String,
						timeLimit: {
							type: Number,
							// default: process.env.NODE_ENV === 'development' ? 1 * 15 : undefined,
						},
						reports: {
							type: Array,
							default: [],
						},
						correctMark: {
							type: Number,
							default: 4,
						},
						incorrectMark: {
							type: Number,
							default: -1,
						},
					},
				],
			},
		],
		sectionGroups: [
			{
				/**
				 * index of sections
				 */
				sections: [{ type: Number }],
				/**
				 * selectionType HIGHEST_SCORE means select sections with highest scores
				 */
				selectionType: { type: String, enum: ['HIGHEST_SCORE'] },
				selectNumberOfSections: { type: Number },
			},
		],
		preAnalysis: {
			type: ObjectId,
			ref: 'PreAnalysis',
		},
		supergroup: {
			type: ObjectId,
			ref: 'SuperGroup',
		},
		wrappers: [
			{
				wrapper: {
					type: ObjectId,
					ref: 'AssessmentWrapper',
				},
			},
		],
		analysis: {
			type: ObjectId,
			ref: 'CoreAnalysis',
		},
		lastCategorized: {
			type: Date,
			default: Date.now,
		},
		markingScheme: {
			multipleCorrect: {
				type: String,
				enum: ['NO_PARTIAL', 'JEE_2019'],
			},
			matchTheColumns: {
				type: String,
				enum: ['NO_PARTIAL', 'JEE_2019'],
			},
		},
		client: {
			type: ObjectId,
			ref: 'Client',
		},
		isArchived: {
			type: Boolean,
			default: false,
		},
		config: {
			questionNumbering: {
				type: String,
				enum: ['overall-increasing', 'section-wise-increasing'],
			},
			extraSections: [{ type: Number }],
		},
		version: {
			type: Number,
			enum: [0, 1],
			default: 0,
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

AssessmentCoreSchema.statics = {
	async get(
		this: AssessmentCoreModelInterface,
		supergroup: string | Types.ObjectId,
		limit: number
	): Promise<AssessmentCoreInterface[]> {
		const filterQuery: FilterQuery<AssessmentCoreInterface> = {
			supergroup,
			isArchived: { $ne: true },
		};
		const cores = await this.find(filterQuery, {
			identifier: 1,
			wrappers: 1,
			duration: 1,
			supergroup: 1,
			analysis: 1,
			preAnalysis: 1,
			syllabus: 1,
			client: 1,
		})
			.populate([
				{
					path: 'analysis',
					select: 'totalAttempts lastCategorized',
				},
				{
					path: 'wrappers.wrapper',
					select:
						'name phases type topic availableFrom availableTill visibleFrom graded isArchived visibleForServices prequel sequel hideResults hideDetailedAnalysis permissions tags',
					populate: [
						{ path: 'phases.phase', select: 'name' },
						{ path: 'visibleForServices', select: 'name' },
						{ path: 'prequel', select: 'name' },
						{ path: 'sequel', select: 'name' },
						{ path: 'permissions.item', select: 'label' },
					],
				},
				{
					path: 'client',
					select: 'name',
				},
			])
			.sort({ _id: -1 })
			.limit(limit);
		const filteredCores = cores.map((core) => {
			const filteredWrappers = core.wrappers.filter((w: any) => {
				if (w.wrapper && !w.wrapper.isArchived) {
					return true;
				} else {
					return false;
				}
			});
			core.wrappers = filteredWrappers;
			return core;
		});
		return filteredCores;
	},

	async getByPhaseIdsOrClient(
		this: AssessmentCoreModelInterface,
		supergroup: string | Types.ObjectId,
		phaseIds: (Types.ObjectId | string)[],
		client: Types.ObjectId | string,
		limit: number
	): Promise<AssessmentCoreInterface[]> {
		const wrappersByPhase = await AssessmentWrapper.find({
			'phases.phase': { $in: phaseIds },
		})
			.select('_id core')
			.sort({ _id: -1 });
		const cores = await this.find(
			{
				$or: [
					{
						supergroup:
							typeof supergroup === 'string' ? Types.ObjectId(supergroup) : supergroup,
						isArchived: { $ne: true },
						_id: { $in: wrappersByPhase.map((w) => w.core) },
					},
					{
						supergroup:
							typeof supergroup === 'string' ? Types.ObjectId(supergroup) : supergroup,

						isArchived: { $ne: true },
						client: typeof client === 'string' ? Types.ObjectId(client) : client,
					},
				],
			},
			{
				identifier: 1,
				wrappers: 1,
				duration: 1,
				supergroup: 1,
				analysis: 1,
				preAnalysis: 1,
				syllabus: 1,
				client: 1,
			}
		)
			.populate([
				{
					path: 'analysis',
					select: 'totalAttempts lastCategorized',
				},
				{
					path: 'wrappers.wrapper',
					select:
						'name phases type topic availableFrom availableTill visibleFrom graded isArchived visibleForServices prequel sequel hideResults hideDetailedAnalysis permissions tags',
					populate: [
						{ path: 'phases.phase', select: 'name' },
						{ path: 'visibleForServices', select: 'name' },
						{ path: 'permissions.item', select: 'label' },
					],
				},
			])
			.sort({ _id: -1 })
			.limit(limit);
		cores.forEach((core) => {
			const filteredWrappers = core.wrappers.filter((w) => {
				if (w.wrapper) {
					const filteredPhases = w.wrapper.phases.filter((phase) => {
						if (
							phaseIds.some(
								(phaseId) => phaseId.toString() === phase.phase._id.toString()
							)
						) {
							return true;
						} else {
							return false;
						}
					});
					w.wrapper.phases = filteredPhases;
					if (!w.wrapper.isArchived && filteredPhases.length) {
						return true;
					} else {
						return false;
					}
				} else {
					return false;
				}
			});
			core.wrappers = filteredWrappers;
		});
		return await Promise.resolve(cores);
	},
};

const AssessmentCore = model<
	AssessmentCoreInterface,
	AssessmentCoreModelInterface
>('AssessmentCore', AssessmentCoreSchema);

export default AssessmentCore;
