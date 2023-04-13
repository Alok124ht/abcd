export const enum QuestionTypes {
	MCSC = 'MULTIPLE_CHOICE_SINGLE_CORRECT',
	MCMC = 'MULTIPLE_CHOICE_MULTIPLE_CORRECT',
	LINKED_MCSC = 'LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT',
	LINKED_MCMC = 'LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT',
	INT = 'INTEGER',
	RANGE = 'RANGE',
	LINKED_RANGE = 'LINKED_RANGE',
}
type QuestionType =
	| 'MULTIPLE_CHOICE_SINGLE_CORRECT'
	| 'MULTIPLE_CHOICE_MULTIPLE_CORRECT'
	| 'LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT'
	| 'LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT'
	| 'INTEGER'
	| 'RANGE'
	| 'LINKED_RANGE';

type IntergerAnswerType = number;
type MCSCAnswerType = string;
type LinkedMCSCAnswerType = MCSCAnswerType;
type MCMCAnswerType = string[];
type LinkedMCMCAnswerType = MCMCAnswerType;
type RangeAnswerType = number;
type LinkedRangeAnswerType = RangeAnswerType;

export type IAnswer =
	| IntergerAnswerType
	| MCSCAnswerType
	| LinkedMCSCAnswerType
	| MCMCAnswerType
	| LinkedMCMCAnswerType
	| RangeAnswerType
	| LinkedRangeAnswerType;
