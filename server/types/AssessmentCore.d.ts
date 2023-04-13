import { Document, Model, Types } from 'mongoose';
import { IQuestion } from '../question/IQuestion';

interface SectionQuestionItemBase {
	topic: string;
	sub_topic: string;
	timeLimit: number;
	correctMark: number;
	incorrectMark: number;
}
interface SectionQuestionItem extends SectionQuestionItemBase {
	question: Types.ObjectId;
}
interface SectionQuestionItemPopulatedQuestion extends SectionQuestionItemBase {
	question: IQuestion;
}

export const enum QuestionGroupSelectionType {
	PickFromStart = 'PFS',
}

export interface QuestionGroup {
	questions: number[];
	selectionType: QuestionGroupSelectionType;
	selectNumberOfQuestions: number;
}

interface AssessmentSectionBase {
	name: string;
	subject: string;
	duration?: number;
	questionGroups?: QuestionGroup[];
}

export interface AssessmentSection extends AssessmentSectionBase {
	questions: SectionQuestionItem[];
	_id: Types.ObjectId;
}

export interface AssessmentSectionPopulatedQuestion
	extends AssessmentSectionBase {
	questions: SectionQuestionItemPopulatedQuestion[];
}

export interface AssessmentSectionGroup {
	sections: number[];
	selectionType?: 'HIGHEST_SCORE';
	selectNumberOfSections: number;
}

interface AssessmentConfig {
	questionNumbering: 'overall-increasing' | 'section-wise-increasing';
	/**
	 * List of section index.
	 * If there are extra sections in an assessment. They will not contribute towards max marks but marks scored will be counted.
	 * Extra sections can be attempted when all the questions of previous sections have been visited at least once
	 * You can not go back to previous sections once you start attempting extra section
	 */
	extraSections: number[];
}

interface AssessmentMarkingScheme {
	multipleCorrect: 'NO_PARTIAL' | 'JEE_2019';
	matchTheColumns: 'NO_PARTIAL' | 'JEE_2019';
}

interface AssessmentCoreBase extends Document {
	indentifier: string;
	instructions: any[];
	sectionInstructions: { text: string; markingScheme: { text: string }[] }[];
	customInstructions: string[];
	syllabus: { topics: { id: string; subTopics: { id: string }[] }[] };
	customSyllabus: { name: string; subTopics: { name: string }[] }[];
	duration: number;
	sectionGroups?: AssessmentSectionGroup[];
	preAnalysis: Types.ObjectId;
	supergroup: Types.ObjectId;
	wrappers: { wrapper: Types.ObjectId }[];
	analysis: Types.ObjectId;
	lastCategorized: Date;
	markingScheme?: AssessmentMarkingScheme;
	config: AssessmentConfig;
	client: Types.ObjectId;
	isArchived: boolean;
	version: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface AssessmentCoreInterface extends AssessmentCoreBase {
	sections: AssessmentSection[];
}

export interface AssessmentCorePopulatedQuestionsInterface
	extends AssessmentCoreBase {
	sections: AssessmentSectionPopulatedQuestion[];
}

export interface AssessmentCoreModelInterface
	extends Model<AssessmentCoreInterface> {
	get(
		superGroupId: string | Types.ObjectId,
		limit: number
	): Promise<AssessmentCoreInterface[]>;
	getByPhaseIdsOrClient(
		superGroupId: string | Types.ObjectId,
		phaseIds: (Types.ObjectId | string)[],
		client: Types.ObjectId | string,
		limit: number
	): Promise<AssessmentCoreInterface[]>;
}
