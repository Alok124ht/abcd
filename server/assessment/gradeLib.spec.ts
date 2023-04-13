import { getPartialMarkingCheckedResponse, gradeAllSections } from './gradeLib';
import { ObjectId } from 'mongodb';
import assert from 'assert';
import { cloneDeep } from 'lodash';

describe('GradeLib', function () {
	describe('getPartialMarkingCheckedResponse', function () {
		const question = {
			multiOptions: [
				{ _id: '1', isCorrect: true },
				{ _id: '2', isCorrect: false },
				{ _id: '3', isCorrect: true },
				{ _id: '4', isCorrect: false },
			],
			answers: [['1', '2']],
		};
		it('should return full marks when all correct multiOptions match', function () {
			assert.deepStrictEqual(
				getPartialMarkingCheckedResponse(
					['1', '3'],
					question.multiOptions,
					question.answers
				),
				{ totalCorrects: 2, totalCorrectResponses: 2, totalIncorrectResponses: 0 }
			);
		});
		it('full marks when all options of one of alternate answers match', function () {
			assert.deepStrictEqual(
				getPartialMarkingCheckedResponse(
					['1', '2'],
					question.multiOptions,
					question.answers
				),
				{ totalCorrects: 2, totalCorrectResponses: 2, totalIncorrectResponses: 0 }
			);
		});

		it('should be 1 correct, 0 incorrect when only one alternate answer matches', function () {
			assert.deepStrictEqual(
				getPartialMarkingCheckedResponse(
					['2'],
					question.multiOptions,
					question.answers
				),
				{ totalCorrects: 2, totalCorrectResponses: 1, totalIncorrectResponses: 0 }
			);
		});

		it('should be 1 correct and 1 incorrect', function () {
			assert.deepStrictEqual(
				getPartialMarkingCheckedResponse(
					['4', '2'],
					question.multiOptions,
					question.answers
				),
				{ totalCorrects: 2, totalCorrectResponses: 1, totalIncorrectResponses: 1 }
			);
		});
	});

	describe('gradeAllSections', function () {
		const question1 = {
			options: [
				{
					_id: new ObjectId(),
					isCorrect: true,
				},
				{
					_id: new ObjectId(),
					isCorrect: false,
				},
			],
			type: 'MULTIPLE_CHOICE_SINGLE_CORRECT',
		};
		const question2 = {
			options: [
				{
					_id: new ObjectId(),
					isCorrect: false,
				},
				{
					_id: new ObjectId(),
					isCorrect: true,
				},
			],
			type: 'MULTIPLE_CHOICE_SINGLE_CORRECT',
		};
		const cSecsWithoutQuestionGroups = [
			{
				questions: [
					{ question: question1, correctMark: 3, incorrectMark: -1 },
					{ question: question2, correctMark: 3, incorrectMark: -1 },
				],
			},
		];
		const cSecsWithQuestionGroups = cSecsWithoutQuestionGroups.map((sec) => ({
			...sec,
			questionGroups: [
				{
					questions: [0, 1],
					selectNumberOfQuestions: 1,
					selectionType: 'PFS',
				},
			],
		}));
		const rSecs = [
			{
				questions: [
					{ answer: question1.options[0]._id.toString() },
					{ answer: question2.options[1]._id.toString() },
				],
			},
		];
		it('Section without QuestionGroups marks check', function () {
			const { marks: marksWithoutQuestionGroups } = gradeAllSections(
				rSecs,
				cSecsWithoutQuestionGroups
			);
			assert.equal(marksWithoutQuestionGroups, 6);
		});
		describe('Section with QuestionGroups marks check', function () {
			it('when all answered correctly', function () {
				assert.equal(gradeAllSections(rSecs, cSecsWithQuestionGroups).marks, 3);
			});

			it('when some skipped and others answered correctly', function () {
				assert.equal(
					gradeAllSections(
						[
							{
								questions: [
									{ answer: null },
									{ answer: question2.options[1]._id.toString() },
								],
							},
						],
						cSecsWithQuestionGroups
					).marks,
					3
				);
			});
			it('when some skipped, and others answered incorrectly', function () {
				assert.equal(
					gradeAllSections(
						[
							{
								questions: [
									{ answer: null },
									{ answer: question2.options[0]._id.toString() },
								],
							},
						],
						cSecsWithQuestionGroups
					).marks,
					-1
				);
			});
			it('when first answered incorrectly, then correctly', function () {
				assert.equal(
					gradeAllSections(
						[
							{
								questions: [
									{ answer: question1.options[1]._id.toString() },
									{ answer: question2.options[1]._id.toString() },
								],
							},
						],
						cSecsWithQuestionGroups
					).marks,
					-1
				);
			});
		});
	});
});

describe('Multiple Choice Multiple Correct Questions', function () {
	const question1 = {
		multiOptions: [
			{
				_id: new ObjectId(),
				isCorrect: true,
			},
			{
				_id: new ObjectId(),
				isCorrect: false,
			},
		],
		type: 'MULTIPLE_CHOICE_MULTIPLE_CORRECT',
	};
	const question2 = {
		multiOptions: [
			{
				_id: new ObjectId(),
				isCorrect: true,
			},
			{
				_id: new ObjectId(),
				isCorrect: false,
			},
		],
		type: 'MULTIPLE_CHOICE_MULTIPLE_CORRECT',
	};
	const linkedQuestion1 = cloneDeep({
		...question1,
		type: 'LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT',
	});
	const linkedQuestion2 = cloneDeep({
		...question2,
		type: 'LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT',
	});
	it('Simple Questions', function () {
		const coreSections = [
			{
				questions: [
					{
						question: question1,
						correctMark: 3,
						incorrectMark: -1,
					},
					{ question: question2, correctMark: 3, incorrectMark: -1 },
				],
			},
		];
		const rSecs1Correct = [
			{
				questions: [
					{ answer: [question1.multiOptions[0]._id.toString()] },
					{ answer: [question2.multiOptions[1]._id.toString()] },
				],
			},
		];
		const { marks: marks1Correct } = gradeAllSections(
			rSecs1Correct,
			coreSections,
			null,
			{ multipleCorrect: 'NO_PARTIAL' }
		);
		assert.equal(marks1Correct, 2);

		const rSecsAllCorrect = [
			{
				questions: [
					{ answer: [question1.multiOptions[0]._id.toString()] },
					{ answer: [question2.multiOptions[0]._id.toString()] },
				],
			},
		];
		const { marks: marksAllCorrect } = gradeAllSections(
			rSecsAllCorrect,
			coreSections,
			null,
			{ multipleCorrect: 'NO_PARTIAL' }
		);
		assert.equal(marksAllCorrect, 6);
	});
	it('Linked Questions', function () {
		const coreSections = [
			{
				questions: [
					{
						question: linkedQuestion1,
						correctMark: 3,
						incorrectMark: -1,
					},
					{ question: linkedQuestion2, correctMark: 3, incorrectMark: -1 },
				],
			},
		];
		const rSecs = [
			{
				questions: [
					{ answer: [linkedQuestion1.multiOptions[0]._id.toString()] },
					{ answer: [linkedQuestion2.multiOptions[1]._id.toString()] },
				],
			},
		];
		const { marks: marksWithoutQuestionGroups } = gradeAllSections(
			rSecs,
			coreSections,
			null,
			{ multipleCorrect: 'NO_PARTIAL' }
		);
		assert.equal(marksWithoutQuestionGroups, 2);
	});
});
