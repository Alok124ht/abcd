import AssessmentCore from '../assessment/assessmentCore.model';
import { Request, Response } from 'express';
import submissionModel from '../assessment/submission.model';
import { Types } from 'mongoose';
const { ObjectId } = Types;

const scheme = [10, 10, 10, 20, 15, 15, 10];

export const sattleCorefor6 = async (req: Request, res: Response) => {
	const core = await AssessmentCore.findById(req.query.core).select(
		'sections wrappers'
	);
	const wrapper = core.wrappers[0].wrapper;
	const oldSections = core.sections[0];
	const questions = oldSections.questions;
	const newSections = [];
	let temp = {
		duration: -1,
		questionGroups: [],
		questions: [],
		name: 'Physics',
	};
	for (var i = 0; i < 13; i++) {
		temp.questions.push(questions[i]);
	}
	newSections.push(temp);
	temp = {
		duration: -1,
		questionGroups: [],
		questions: [],
		name: 'Chemistry',
	};
	for (var i = 13; i < 26; i++) {
		temp.questions.push(questions[i]);
	}
	newSections.push(temp);
	temp = {
		duration: -1,
		questionGroups: [],
		questions: [],
		name: 'Biology',
	};
	for (var i = 26; i < 40; i++) {
		temp.questions.push(questions[i]);
	}
	newSections.push(temp);
	temp = {
		duration: -1,
		questionGroups: [],
		questions: [],
		name: 'Mathematics',
	};
	for (var i = 40; i < 60; i++) {
		temp.questions.push(questions[i]);
	}
	newSections.push(temp);
	temp = {
		duration: -1,
		questionGroups: [],
		questions: [],
		name: 'Social Science',
	};
	for (var i = 60; i < 100; i++) {
		temp.questions.push(questions[i]);
	}
	newSections.push(temp);
	// temp = {
	// 	duration: -1,
	// 	questionGroups: [],
	// 	questions: [],
	// 	name: 'Social Science',
	// };
	// for (var i = 65; i < 80; i++) {
	// 	temp.questions.push(questions[i]);
	// }
	// newSections.push(temp);
	// temp = {
	// 	duration: -1,
	// 	questionGroups: [],
	// 	questions: [],
	// 	name: 'Mental Ability',
	// };
	// for (var i = 80; i < 90; i++) {
	// 	temp.questions.push(questions[i]);
	// }
	// newSections.push(temp);
	// const changedCore = await AssessmentCore.updateOne(core, {
	// 	$set: {
	// 		sections: newSections,
	// 	},
	// });

	// if (changedCore) {

	res.send(newSections);
	// } else {
	// 	res.send('Core failed');
	// }
	// res.send(newSections);
};

export const sattleSubmissions6 = async (req: Request, res: Response) => {
	try {
		const submission = await submissionModel
			.findById(req.query.submission)
			.select('response originalResponse');
		console.log('here1');
		// submissions.forEach((submission) => {
		const questions = submission.originalResponse.sections[0].questions;

		let tempObj = {
			sections: [],
		};
		let temp = {
			totalQuestions: 13,
			name: 'Physics',
			questions: [],
		};
		for (var i = 0; i < 13; i++) {
			temp.questions.push(questions[i]);
		}
		console.log('here2');

		tempObj.sections.push(temp);
		temp = {
			totalQuestions: 13,
			name: 'Chemistry',
			questions: [],
		};
		for (var i = 13; i < 26; i++) {
			temp.questions.push(questions[i]);
		}
		console.log('here2');

		tempObj.sections.push(temp);
		temp = {
			totalQuestions: 14,
			name: 'Biology',
			questions: [],
		};
		for (var i = 26; i < 40; i++) {
			temp.questions.push(questions[i]);
		}
		console.log('here3');

		tempObj.sections.push(temp);
		temp = {
			totalQuestions: 20,
			name: 'Mathematics',
			questions: [],
		};
		for (var i = 40; i < 60; i++) {
			temp.questions.push(questions[i]);
		}
		console.log('here4');

		tempObj.sections.push(temp);
		temp = {
			totalQuestions: 40,
			name: 'Social Science',
			questions: [],
		};
		for (var i = 60; i < 100; i++) {
			temp.questions.push(questions[i]);
		}
		console.log('here5');

		tempObj.sections.push(temp);
		// temp = {
		// 	totalQuestions: 10,
		// 	name: 'Social Science',
		// 	questions: [],
		// };
		// for (var i = 65; i < 80; i++) {
		// 	temp.questions.push(questions[i]);
		// }
		// console.log('here5');

		// tempObj.sections.push(temp);
		// temp = {
		// 	totalQuestions: 10,
		// 	name: 'Mental Ability',
		// 	questions: [],
		// };
		// for (var i = 80; i < 90; i++) {
		// 	temp.questions.push(questions[i]);
		// }
		// console.log('here6');

		// tempObj.sections.push(temp);
		// });
		res.send(tempObj.sections);
	} catch (e) {
		res.send('error');
	}
};

export const manageCore = () => {};
