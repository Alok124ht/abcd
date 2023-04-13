import { Schema, model } from 'mongoose';
import { xp } from '../constants';
import { AssessmentWrapperInterface } from '../types/AssessmentWrapper';

const ObjectId = Schema.Types.ObjectId;

const AssessmentWrapperSchema = new Schema(
	{
		core: {
			type: ObjectId,
			ref: 'AssessmentCore',
		},
		name: {
			type: String,
		},
		slang: {
			type: String,
			default: '',
		},
		type: {
			type: String,
			required: true,
			enum: ['FULL-MOCK', 'LIVE-TEST', 'SECTIONAL-MOCK', 'TOPIC-MOCK'],
		},
		series: {
			type: String,
			default: '',
		},
		topic: {
			type: String,
			default: '',
		},
		section: {
			type: String,
			default: '',
		},
		difficulty: {
			type: String,
		},
		label: { type: String, default: '' },
		availableFrom: {
			type: Date,
		},
		availableTill: {
			type: Date,
		},
		gradeTime: {
			type: Date,
		},
		visibleFrom: {
			type: Date,
		},
		expiresOn: {
			type: Date,
		},
		graded: {
			type: Boolean,
			default: false,
		},
		locked: {
			type: Boolean,
			default: false,
		},
		isCategorized: {
			type: Boolean,
			default: false,
		},
		cost: {
			type: Number,
			default: xp.assessment_cost,
		},
		reward: {
			type: Number,
			default: xp.assessment_reward,
		},
		phases: [
			{
				phase: { type: ObjectId, ref: 'Phase' },
				name: { type: String, default: '' },
				slang: { type: String, default: '' },
				availableFrom: { type: Date },
				expiresOn: { type: Date },
			},
		],
		permissions: [
			{
				item: {
					type: ObjectId,
					refPath: 'permissions.itemType',
				},
				itemType: {
					type: String,
					// item type is model name
					enum: ['Phase', 'UserGroup', 'User'],
				},
				name: { type: String, default: '' },
				slang: { type: String, default: '' },
				availableFrom: { type: Date },
				expiresOn: { type: Date },
			},
		],
		visibleForServices: [
			{
				type: ObjectId,
				ref: 'Service',
			},
		],
		description: {
			type: String,
			default: '',
		},
		comps: {
			// companies will later be array!!
			type: String,
			default: '',
		},
		messages: [
			{
				type: {
					type: String,
				},
				message: String,
			},
		],
		analysis: {
			type: ObjectId,
			ref: 'WrapperAnalysis',
		},
		isArchived: {
			type: Boolean,
			default: false,
		},
		hideDetailedAnalysis: {
			type: Boolean,
		},
		hideResults: {
			type: Boolean,
			default: false,
		},
		sequel: {
			type: ObjectId,
			ref: 'AssessmentWrapper',
		},
		prequel: {
			type: ObjectId,
			ref: 'AssessmentWrapper',
		},
		showInReports: {
			type: Boolean,
			default: true,
		},
		tags: [
			{
				key: {
					type: String,
				},
				value: {
					type: String,
				},
			},
		],
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

const AssessmentWrapper = model<AssessmentWrapperInterface>(
	'AssessmentWrapper',
	AssessmentWrapperSchema
);

export default AssessmentWrapper;
