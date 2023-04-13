import { QuestionTypes } from '../QuestionType';

export function isTypeTransitionPossible(
	currentType: QuestionTypes,
	targetType: QuestionTypes
) {
	const possibleTransitions: { [key in QuestionTypes]: QuestionTypes[] } = {
		[QuestionTypes.LINKED_MCSC]: [
			QuestionTypes.LINKED_MCMC,
			QuestionTypes.LINKED_RANGE,
		],
		[QuestionTypes.LINKED_MCMC]: [
			QuestionTypes.LINKED_MCSC,
			QuestionTypes.LINKED_RANGE,
		],
		[QuestionTypes.LINKED_RANGE]: [
			QuestionTypes.LINKED_MCSC,
			QuestionTypes.LINKED_MCMC,
		],

		[QuestionTypes.RANGE]: [QuestionTypes.MCSC, QuestionTypes.MCMC],
		[QuestionTypes.MCSC]: [QuestionTypes.MCMC, QuestionTypes.RANGE],
		[QuestionTypes.MCMC]: [QuestionTypes.MCSC, QuestionTypes.RANGE],
		[QuestionTypes.INT]: [],
	};
	return (
		possibleTransitions[currentType] &&
		possibleTransitions[currentType].includes(targetType)
	);
}
