import { Document, Types } from 'mongoose';
import { TagList } from './Tag';
import { AssessmentCoreInterface } from './AssessmentCore';

export interface PublishedInPhaseDetail {
	phase: Types.ObjectId;
	name?: string;
	slang?: string;
	availableFrom?: Date;
	expiresOn?: Date;
}

interface AssessmentWrapperBase {
	name: string;
	slang?: string;
	type: 'FULL-MOCK' | 'LIVE-TEST' | 'SECTIONAL-MOCK' | 'TOPIC-MOCK';
	series?: string;
	topic?: string;
	section: string;
	difficulty?: string;
	label?: string;
	availableFrom?: Date;
	availableTill?: Date;
	gradeTime?: Date;
	visibleFrom?: Date;
	expiresOn?: Date;
	graded?: boolean;
	locked: boolean;
	isCategorized: boolean;
	cost: number;
	reward: number;
	phases: PublishedInPhaseDetail[];
	permissions: {
		item: Types.ObjectId;
		itemType: 'Phase' | 'UserGroup' | 'User';
		name?: string;
		slang: string;
		availableFrom?: Date;
		expiresOn?: Date;
	}[];
	visibleForServices: Types.ObjectId[];
	description: string;
	comps: string;
	messages: {
		type: string;
		message: string;
	}[];
	analysis: Types.ObjectId;
	isArchived: boolean;
	hideResults: boolean;
	hideDetailedAnalysis: boolean;
	sequel: Types.ObjectId;
	prequel: Types.ObjectId;
	showInReports: boolean;
	createdAt: Date;
	updatedAt: Date;
	tags?: TagList[];
}

export interface AssessmentWrapperInterface
	extends AssessmentWrapperBase,
		Document {
	core: Types.ObjectId | AssessmentCoreInterface;
}

export interface AssessmentWrapperCorePopulatedInterface
	extends AssessmentWrapperBase,
		Document {
	core: AssessmentCoreInterface;
}
