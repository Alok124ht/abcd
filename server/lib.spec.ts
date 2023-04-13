import { getSecMaxMarks, getMaxMarks } from './lib';
import assert from 'assert';

const normalSection = {
	questions: [
		{
			correctMark: 2,
		},
		{
			correctMark: 2,
		},
		{
			correctMark: 2,
		},
		{
			correctMark: 2,
		},
		{
			correctMark: 2,
		},
		{
			correctMark: 2,
		},
	],
};
describe('verify section total marks calculations', function () {
	it('sectional marks for normal test', function () {
		assert.equal(getSecMaxMarks(normalSection), 12);
	});
	const selectFirstNFromSection = Object.assign({}, normalSection, {
		questionGroups: [
			{
				questions: [0, 1, 2],
				selectNumberOfQuestions: 2,
				selectionType: 'PFS',
			},
		],
	});
	it('sectional marks when optional questions are present', function () {
		assert.equal(getSecMaxMarks(selectFirstNFromSection), 10);
	});
});

describe('verify maxMarks calculations', function () {
	const normalAssessment = {
		sections: [normalSection, normalSection],
	};
	const withExtraAssessment = {
		sections: [normalSection, normalSection],
		config: {
			extraSections: [1],
		},
	};
	it('total marks when no extra sections assessment', function () {
		const normalMaxMarks = getMaxMarks(normalAssessment);
		assert.equal(normalMaxMarks, 24);
	});
	it('total marks when extra section present ', function () {
		const extraSectionMaxMarks = getMaxMarks(withExtraAssessment);
		assert.equal(extraSectionMaxMarks, 12);
	});
});
