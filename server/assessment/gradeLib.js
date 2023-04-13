/* eslint-disable no-param-reassign */
const { cloneDeep, forEach, get, includes, size, some } = require('lodash');
const Submission = require('./submission.model').default;
const lib = require('../lib.js'); // all simple functions are declared here, which don't need to be changed/understood
const { questionTypeMap: newTypeMap } = require('../constants');

const WrapperAnalyst = require('../globals/WrapperAnalyst');
const StatsAndCategoryManager = require('../globals/StatsAndCategoryManager');
const logger = require('../../config/winston').default;
const LeaderboardManager = require('../globals/LeaderboardManager');
const { getActivePhasesFromSubscriptions } = require('../utils/phase/index');

const {
	initializeStats,
	getTopper,
	updateHistogram,
	isAnswerCorrect,
	isAnswered,
	getMaxMarks,
	getSecMaxMarks,
} = lib;

function getCheckedResponses(response, options) {
	try {
		let totalCorrects = 0;
		let totalCorrectResponses = 0;
		let totalIncorrectResponses = 0;
		let hasErrorInResponse = false;
		if (Array.isArray(response)) {
			response.forEach((r) => {
				if (!r) {
					hasErrorInResponse = true;
				}
				options.forEach((o) => {
					if (r === o._id.toString()) {
						if (o.isCorrect) {
							totalCorrectResponses += 1;
						} else {
							totalIncorrectResponses += 1;
						}
					}
				});
			});
		}
		options.forEach((o) => {
			if (o.isCorrect) {
				totalCorrects += 1;
			}
		});

		let totalAlternateCorrects = 0;
		let totalAlternateCorrectResponses = 0;
		let totalAlternateIncorrectResponses = 0;
		if (Array.isArray(response)) {
			response.forEach((r) => {
				if (!r) {
					hasErrorInResponse = true;
				}
				options.forEach((o) => {
					if (r.toString() === o._id.toString()) {
						if (o.isAlternateCorrect) {
							totalAlternateCorrectResponses += 1;
						} else {
							totalAlternateIncorrectResponses += 1;
						}
					}
				});
			});
		}
		if (hasErrorInResponse) {
			logger.info(
				`answer had undefined response option ${JSON.stringify(response)}`
			);
		}
		options.forEach((o) => {
			if (o.isCorrect) {
				totalAlternateCorrects += 1;
			}
		});

		if (totalIncorrectResponses && totalAlternateIncorrectResponses) {
			// return any
			return { totalCorrects, totalCorrectResponses, totalIncorrectResponses };
		}
		if (!totalIncorrectResponses && totalAlternateIncorrectResponses) {
			// return any
			return { totalCorrects, totalCorrectResponses, totalIncorrectResponses };
		}
		if (totalIncorrectResponses && !totalAlternateIncorrectResponses) {
			// return any
			return {
				totalAlternateCorrects,
				totalAlternateCorrectResponses,
				totalAlternateIncorrectResponses,
			};
		}
		if (
			// return any
			totalCorrectResponses * totalAlternateCorrects >
			totalAlternateCorrectResponses * totalCorrects
		) {
			return { totalCorrects, totalCorrectResponses, totalIncorrectResponses };
		}
		return {
			totalAlternateCorrects,
			totalAlternateCorrectResponses,
			totalAlternateIncorrectResponses,
		};
	} catch (e) {
		logger.error(
			`error occurred while grading a question; in fn getCheckedResponses; ${JSON.stringify(
				response
			)}, ${JSON.stringify(options)}`
		);
		return {
			totalCorrects: 4,
			totalIncorrectResponses: 4,
			totalCorrectResponses: 0,
		};
	}
}

function getPartialMarkingCheckedResponse(response, options, alternateAnswers) {
	const dummyOptions = [];
	forEach(alternateAnswers, (alternateAnswer) => {
		const dummyOption = [];
		options.forEach((option) => {
			dummyOption.push({
				...(option.toObject ? option.toObject() : option),
				isCorrect: includes(alternateAnswer, option._id),
			});
			dummyOptions.push(dummyOption);
		});
	});
	let bestPossibleScheme = null;
	[options, ...dummyOptions].forEach((item) => {
		const {
			totalCorrects,
			totalIncorrectResponses,
			totalCorrectResponses,
		} = getCheckedResponses(response, item);
		if (!bestPossibleScheme) {
			bestPossibleScheme = {
				totalCorrects,
				totalIncorrectResponses,
				totalCorrectResponses,
			};
		} else {
			const score = (b) =>
				((b.totalCorrectResponses || 0) - (b.totalIncorrectResponses || 0)) /
				b.totalCorrects;
			if (
				score(bestPossibleScheme) <
				score({ totalCorrects, totalIncorrectResponses, totalCorrectResponses })
			) {
				bestPossibleScheme = {
					totalCorrects,
					totalIncorrectResponses,
					totalCorrectResponses,
				};
			}
		}
	});
	return bestPossibleScheme;
}

function getCorrectMatches() {
	const totalCorrects = 0;
	const totalCorrectMatches = 0;
	const totalIncorrectMatches = 0;
	return { totalCorrects, totalCorrectMatches, totalIncorrectMatches };
}

function getGradedQuestion(
	response,
	time,
	question,
	bonusQuestions,
	markingScheme
) {
	const bonus = !!(bonusQuestions && bonusQuestions[question.question._id]);
	const isAnswered_ = bonus ? true : isAnswered(response);

	const newType = newTypeMap[question.question.type] || question.question.type;

	if (
		markingScheme &&
		newType === 'MULTIPLE_CHOICE_MULTIPLE_CORRECT' &&
		markingScheme.multipleCorrect === 'JEE_2019'
	) {
		const {
			totalCorrects,
			totalCorrectResponses,
			totalIncorrectResponses,
		} = getPartialMarkingCheckedResponse(
			response,
			question.question.multiOptions,
			question.question.answers
		);

		let markGained = 0;
		let markLost = 0;
		if (bonus) {
			markGained = question.correctMark;
		} else if (!isAnswered_) {
			// nothing
		} else if (totalIncorrectResponses) {
			markLost = question.incorrectMark;
		} else if (totalCorrects === totalCorrectResponses) {
			markGained = question.correctMark;
		} else if (totalCorrects === 4 && totalCorrectResponses === 3) {
			markGained = (3 * question.correctMark) / 4;
		} else if (totalCorrects >= 3 && totalCorrectResponses === 2) {
			markGained = (2 * question.correctMark) / 4;
		} else if (totalCorrects >= 2 && totalCorrectResponses === 1) {
			markGained = (1 * question.correctMark) / 4;
		} else {
			markLost = question.incorrectMark;
		}

		const mark = markGained || markLost;

		const addToCorrect = markGained ? 1 : 0;
		const addToIncorrect = markLost ? 1 : 0;
		const addToUnattempted = !isAnswered_ ? 1 : 0;
		const addToCorrectTime = markGained ? time : 0;
		const addToIncorrectTime = markLost ? time : 0;
		const addToUnattemptedTime = !isAnswered_ ? time : 0;

		const markAttempted = isAnswered_ ? question.correctMark : 0;
		let isCorrect = -1;
		if (markGained) {
			isCorrect = 1;
		} else if (markLost) {
			isCorrect = 0;
		}

		return {
			mark,
			// answer,
			isAnswered_,
			addToCorrect,
			addToIncorrect,
			addToUnattempted,
			addToCorrectTime,
			addToIncorrectTime,
			addToUnattemptedTime,
			markAttempted,
			markGained,
			markLost,
			isCorrect,
		};
	}
	if (
		markingScheme &&
		question.question.type === 'MATCH_THE_COLUMNS' &&
		markingScheme.multipleCorrect === 'JEE_2019'
	) {
		// const isCorrect_ = bonus
		// 	? true
		// 	: isAnswerCorrect(response, question.question);

		const { totalCorrects, totalCorrectMatches } = getCorrectMatches();

		let markGained = 0;
		let markLost = 0;
		if (bonus) {
			markGained = question.correctMark;
		} else if (!isAnswered_) {
			// nothing
		} else if (totalCorrects === totalCorrectMatches) {
			markGained = question.correctMark;
		} else {
			markLost = question.incorrectMark;
		}
		const mark = markGained || markLost;

		const addToCorrect = markGained ? 1 : 0;
		const addToIncorrect = markLost ? 1 : 0;
		const addToUnattempted = !isAnswered_ ? 1 : 0;
		const addToCorrectTime = markGained ? time : 0;
		const addToIncorrectTime = markLost ? time : 0;
		const addToUnattemptedTime = !isAnswered_ ? time : 0;

		const markAttempted = isAnswered_ ? question.correctMark : 0;
		let isCorrect = -1;
		if (markGained) {
			isCorrect = 1;
		} else if (markLost) {
			isCorrect = 0;
		}

		return {
			mark,
			// answer,//answer can be complicated. check it
			isAnswered_,
			addToCorrect,
			addToIncorrect,
			addToUnattempted,
			addToCorrectTime,
			addToIncorrectTime,
			addToUnattemptedTime,
			markAttempted,
			markGained,
			markLost,
			isCorrect,
		};
	}
	const isCorrect_ = bonus ? true : isAnswerCorrect(response, question.question);
	let mark = 0;
	if (isCorrect_) {
		mark = question.correctMark;
	} else if (isAnswered_) {
		mark = question.incorrectMark;
	}

	// let answer = '';
	// options.forEach((option) => {
	// 	if (option.isCorrect) answer = option._id;
	// });

	const addToCorrect = isCorrect_ ? 1 : 0;
	const addToIncorrect = isAnswered_ && !isCorrect_ ? 1 : 0;
	const addToUnattempted = !isAnswered_ ? 1 : 0;
	const addToCorrectTime = isCorrect_ ? time : 0;
	const addToIncorrectTime = isAnswered_ && !isCorrect_ ? time : 0;
	const addToUnattemptedTime = !isAnswered_ ? time : 0;

	const markAttempted = isAnswered_ ? question.correctMark : 0;
	const markGained = isCorrect_ ? question.correctMark : 0;
	const markLost = isAnswered_ && !isCorrect_ ? question.incorrectMark : 0;
	let isCorrect = -1;
	if (isCorrect_) {
		isCorrect = 1;
	} else if (isAnswered_) {
		isCorrect = 0;
	}

	return {
		mark,
		// answer,
		isAnswered_,
		addToCorrect,
		addToIncorrect,
		addToUnattempted,
		addToCorrectTime,
		addToIncorrectTime,
		addToUnattemptedTime,
		markAttempted,
		markGained,
		markLost,
		isCorrect,
	};
}

function gradeAllSections(
	rSecs,
	cSecs,
	bonusQuestions,
	markingScheme,
	sectionGroups
) {
	const meta = {};
	let correctTime = 0;
	let incorrectTime = 0;
	let unattemptedTime = 0;
	const difficulty = {
		easy: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0 },
		medium: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0 },
		hard: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0 },
	};
	meta.sections = rSecs.map((sec, secIndex) => {
		let time = 0;
		let secMarks = 0;
		let secCorrect = 0;
		let secIncorrect = 0;
		let secCorrectTime = 0;
		let secIncorrectTime = 0;
		let secUnattemptedTime = 0;
		let secMarksAttempted = 0;
		let secMarksGained = 0;
		let secMarksLost = 0;
		const questionsCountedByQuestionGroupIndex = { '-1': 0 };
		const questionCountLimitByQuestionGroupIndex = { '-1': Infinity };

		const questionGroupIndexByQuestionIndex = {};
		forEach(
			cSecs[secIndex].questionGroups,
			(questionGroup, questionGroupIndex) => {
				questionsCountedByQuestionGroupIndex[questionGroupIndex] = 0;
				questionCountLimitByQuestionGroupIndex[questionGroupIndex] =
					questionGroup.selectNumberOfQuestions;
				forEach(questionGroup.questions, (questionIndex) => {
					questionGroupIndexByQuestionIndex[questionIndex] = questionGroupIndex;
				});
			}
		);
		return {
			_id: sec._id,
			name: sec.name,
			questions: sec.questions.map((que, queIndex) => {
				const {
					mark,
					answer,
					addToCorrect,
					addToIncorrect,
					addToCorrectTime,
					addToIncorrectTime,
					addToUnattemptedTime,
					markAttempted,
					markGained,
					markLost,
					isCorrect,
				} = getGradedQuestion(
					que.answer,
					que.time / 1000.0,
					cSecs[secIndex].questions[queIndex],
					bonusQuestions,
					markingScheme
				);

				let shouldThisQuestionCount = true;
				const questionGroupIndex = get(
					questionGroupIndexByQuestionIndex,
					[queIndex],
					-1
				);

				if (
					questionsCountedByQuestionGroupIndex[questionGroupIndex] >=
					questionCountLimitByQuestionGroupIndex[questionGroupIndex]
				) {
					shouldThisQuestionCount = false;
				}
				if (shouldThisQuestionCount && que.answer !== null) {
					questionsCountedByQuestionGroupIndex[questionGroupIndex] += 1;
				}
				if (shouldThisQuestionCount) {
					// marks += mark;
					time += que.time / 1000.0;
					secMarks += mark;
					secCorrect += addToCorrect;
					secIncorrect += addToIncorrect;
					correctTime += addToCorrectTime;
					secCorrectTime += addToCorrectTime;
					incorrectTime += addToIncorrectTime;
					secIncorrectTime += addToIncorrectTime;
					unattemptedTime += addToUnattemptedTime;
					secUnattemptedTime += addToUnattemptedTime;
					secMarksAttempted += markAttempted;
					secMarksGained += markGained;
					secMarksLost += markLost;
					const { level } = cSecs[secIndex].questions[queIndex].question;
					if (level === 1 && que.answer) {
						difficulty.easy.correct += addToCorrect;
						difficulty.easy.incorrect += answer != que.answer ? 1 : 0;
						difficulty.easy.time += que.time / 1000.0;
						difficulty.easy.totalAttempts += 1;
					} else if (level === 2 && que.answer) {
						difficulty.medium.correct += addToCorrect;
						difficulty.medium.incorrect += answer != que.answer ? 1 : 0;
						difficulty.medium.time += que.time / 1000.0;
						difficulty.medium.totalAttempts += 1;
					} else if (level === 3 && que.answer) {
						difficulty.hard.correct += addToCorrect;
						difficulty.hard.incorrect += answer != que.answer ? 1 : 0;
						difficulty.hard.time += que.time / 1000.0;
						difficulty.hard.totalAttempts += 1;
					}
				}

				return {
					_id: que._id,
					answer,
					mark,
					time: que.time / 1000.0,
					correct: isCorrect,
				}; // 0=incorrect, 1=correct, -1=unattempted
			}),
			time,
			correctTime: secCorrectTime,
			incorrectTime: secIncorrectTime,
			unattemptedTime: secUnattemptedTime,
			marks: secMarks,
			marksAttempted: secMarksAttempted,
			marksGained: secMarksGained,
			marksLost: secMarksLost,
			correct: secCorrect,
			incorrect: secIncorrect,
			precision:
				secCorrect + secIncorrect > 0
					? Math.round((10000.0 * secCorrect) / (secCorrect + secIncorrect)) / 100.0
					: 0,
		};
	});

	let correct = 0;
	let incorrect = 0;

	let marks = 0;
	let marksAttempted = 0;
	let marksGained = 0;
	let marksLost = 0;
	/**
	 * select sections for section groups
	 */
	const selectedSectionsBySectionGroup = {};
	const nonGroupSections = [];
	forEach(meta.sections, (section, sectionIndex) => {
		let isInSomeGroup = false;
		forEach(sectionGroups, (sectionGroup, sectionGroupIndex) => {
			if (includes(sectionGroup.sections, sectionIndex)) {
				const comparisionMultiplier =
					sectionGroup.selectionType === 'HIGHEST' ? 1 : -1;
				if (!selectedSectionsBySectionGroup[sectionGroupIndex]) {
					selectedSectionsBySectionGroup[sectionGroupIndex] = [];
				}
				let insertAt = selectedSectionsBySectionGroup[sectionGroupIndex].length;
				some(selectedSectionsBySectionGroup[sectionGroupIndex], (it, itIndex) => {
					if (
						it.marks * comparisionMultiplier >
						section.marks * comparisionMultiplier
					) {
						insertAt = itIndex;
						return true;
					}
					return false;
				});

				selectedSectionsBySectionGroup[sectionGroupIndex].splice(
					insertAt,
					0,
					section
				);

				selectedSectionsBySectionGroup[sectionGroupIndex].splice(
					sectionGroup.selectNumberOfSections,
					size(selectedSectionsBySectionGroup[sectionGroupIndex])
				);
				isInSomeGroup = true;
			}
		});
		if (!isInSomeGroup) {
			nonGroupSections.push(section);
		}
	});

	/**
	 * select sections for section groups ends here
	 */

	marks = 0;

	const sectionsToConsider = [...nonGroupSections];

	forEach(selectedSectionsBySectionGroup, (selectedSections) => {
		forEach(selectedSections, (selectedSection) => {
			sectionsToConsider.push(selectedSection);
		});
	});
	forEach(sectionsToConsider, (section) => {
		correct += section.correct;
		incorrect += section.incorrect;

		marks += section.marks;
		marksAttempted += section.marksAttempted;
		marksGained += section.marksGained;
		marksLost += section.marksLost;
	});

	meta.marks = marks;
	meta.questionsAttempted = correct + incorrect; // required?? bonus?
	meta.correctQuestions = correct;
	meta.incorrectQuestions = incorrect;
	meta.correctTime = correctTime;
	meta.incorrectTime = incorrectTime;
	meta.unattemptedTime = unattemptedTime;
	meta.precision =
		correct + incorrect
			? Math.round((10000.0 * correct) / (correct + incorrect)) / 100.0
			: 0;
	meta.marksAttempted = marksAttempted;
	meta.marksGained = marksGained;
	meta.marksLost = marksLost;
	meta.difficulty = difficulty;
	return meta;
}

function getCommonPhases(userPhases, assessmentWrapperPhases) {
	const commonPhases = [];
	const userPhasesMap = {};
	userPhases.forEach((up) => {
		userPhasesMap[up] = true;
	});
	assessmentWrapperPhases.forEach((phase) => {
		if (userPhasesMap[phase.phase]) {
			commonPhases.push(phase.phase);
		}
	});
	return commonPhases;
}

function gradeSubmission(
	submission,
	assessmentCore,
	bonusQuestions,
	lateSubmission,
	userPhases,
	wrapperPhases,
	wrapperType
) {
	const filteredBonus = {};
	const tt = new Date().getTime();
	if (bonusQuestions) {
		Object.keys(bonusQuestions).forEach((k) => {
			const bt = new Date(bonusQuestions[k]).getTime();
			if (bt >= tt) {
				filteredBonus[k] = true;
			}
		});
	}

	const meta = gradeAllSections(
		submission.response.sections,
		assessmentCore.sections,
		filteredBonus,
		assessmentCore.markingScheme,
		assessmentCore.sectionGroups
	);

	const phases = getCommonPhases(userPhases, wrapperPhases);
	phases.forEach((phaseId) => {
		LeaderboardManager.enqueueLeaderboardData(
			{
				submissionId: submission._id,
				userId: submission.user,
				marks: meta.marks,
			},
			submission.assessmentWrapper._id,
			phaseId,
			wrapperType
		);

		LeaderboardManager.processLeaderboard();
	});

	submission.meta = meta;

	StatsAndCategoryManager.processCategory(
		// this should be standalone api
		submission.user,
		assessmentCore,
		submission
	);

	StatsAndCategoryManager.processStats(
		// this should be standalone api
		submission.user,
		meta.sections,
		assessmentCore.sections,
		submission.assessmentWrapper._id
	);
	return meta;
}

function updateSectionStats(
	sectionStats,
	difficultyStats,
	submissionSections, // meta.sections
	cSecs,
	user,
	analysisSource
) {
	const newSectionStats = sectionStats;
	const newDifficultyStats = difficultyStats;
	submissionSections.forEach((sec, sIdx) => {
		sec.questions.forEach((que, qIdx) => {
			const { question: cQ } = cSecs[sIdx].questions[qIdx];
			const isCorrect_ = que.correct === 1;
			const isAnswered_ = que.correct !== -1;
			const addToCorrect = que.correct === 1 ? 1 : 0;
			const addToIncorrect = que.correct === 0 ? 1 : 0;
			const addToAttempt = isAnswered_ ? 1 : 0;

			if (cQ.level === 1 && isAnswered_) {
				difficultyStats.easy.correct += addToCorrect;
				difficultyStats.easy.incorrect += addToIncorrect;
				difficultyStats.easy.time += que.time; // should we store only the correct time???
				difficultyStats.easy.times.push(que.time);
				difficultyStats.easy.totalAttempts += 1;
			} else if (cQ.level === 2 && isAnswered_) {
				difficultyStats.medium.correct += addToCorrect;
				difficultyStats.medium.incorrect += addToIncorrect;
				difficultyStats.medium.time += que.time; // should we store only the correct time???
				difficultyStats.medium.times.push(que.time); // should we store only the correct time???
				difficultyStats.medium.totalAttempts += 1;
			} else if (cQ.level === 3 && isAnswered_) {
				difficultyStats.hard.correct += addToCorrect;
				difficultyStats.hard.incorrect += addToIncorrect;
				difficultyStats.hard.time += que.time; // should we store only the correct time???
				difficultyStats.hard.times.push(que.time); // should we store only the correct time???
				difficultyStats.hard.totalAttempts += 1;
			}

			if (analysisSource === 'core') {
				if (isCorrect_) {
					newSectionStats[sIdx].questions[qIdx].sumTime += que.time;
					newSectionStats[sIdx].questions[qIdx].times.push(que.time);
					newSectionStats[sIdx].questions[qIdx].sumSqTime += que.time * que.time;
				}
				if (isAnswered_) {
					newSectionStats[sIdx].questions[qIdx].correctAttempts += addToCorrect;
				}
				newSectionStats[sIdx].questions[qIdx].totalAttempts += addToAttempt;
			}
		});
		newSectionStats[sIdx].sumTime += sec.time;
		newSectionStats[sIdx].times.push(sec.time);
		newSectionStats[sIdx].marks.push(sec.marks);
		newSectionStats[sIdx].sumMarks += sec.marks;
		newSectionStats[sIdx].correct += sec.correct;
		newSectionStats[sIdx].incorrect += sec.incorrect;
	});
	return { sectionStats: newSectionStats, difficultyStats: newDifficultyStats };
}

function copyWrapperStats(wrapperAnalysis, assessmentCore) {
	const stats = {};
	stats.marks = wrapperAnalysis.marks;
	stats.hist = wrapperAnalysis.hist;
	stats.topper = wrapperAnalysis.topper;
	stats.sumAccuracy = wrapperAnalysis.sumAccuracy;
	stats.sumSqAccuracy = wrapperAnalysis.sumSqAccuracy;
	stats.difficulty = wrapperAnalysis.difficulty;
	stats.sumMarks = wrapperAnalysis.sumMarks;
	stats.maxMarks = getMaxMarks(assessmentCore);
	stats.sections = wrapperAnalysis.sections.map((sec, i) => ({
		id: sec.id,
		incorrect: sec.incorrect,
		correct: sec.correct,
		sumMarks: sec.sumMarks,
		marks: sec.marks,
		sumTime: sec.sumTime,
		hist: sec.hist,
		times: sec.times,
		maxMarks: getSecMaxMarks(assessmentCore.sections[i]),
	}));
	return stats;
}

function copyCoreStats(coreAnalysis) {
	const stats = {};
	stats.marks = coreAnalysis.marks;
	stats.hist = coreAnalysis.hist;
	// stats.topper = coreAnalysis.topper;
	stats.sumAccuracy = coreAnalysis.sumAccuracy;
	stats.sumSqAccuracy = coreAnalysis.sumSqAccuracy;
	stats.sumPickingAbility = coreAnalysis.sumPickingAbility;
	stats.sumSqPickingAbility = coreAnalysis.sumSqPickingAbility;
	stats.difficulty = coreAnalysis.difficulty;
	stats.sumMarks = coreAnalysis.sumMarks;
	stats.maxMarks = coreAnalysis.maxMarks;
	stats.sections = coreAnalysis.sections.map((sec) => ({
		id: sec.id,
		incorrect: sec.incorrect,
		correct: sec.correct,
		sumMarks: sec.sumMarks,
		marks: sec.marks,
		sumTime: sec.sumTime,
		times: sec.times,
		hist: sec.hist,
		maxMarks: sec.maxMarks,
		questions: sec.questions.map((que) => ({
			id: que.id,
			sumSqTime: que.sumSqTime,
			sumTime: que.sumTime,
			times: que.times,
			correctAttempts: que.correctAttempts,
			totalAttempts: que.totalAttempts,
		})),
	}));
	return stats;
}

function gradeSubmissionsUpdateAssessment(
	assessmentWrapper,
	assessmentCore,
	wrapperAnalysis,
	submissions,
	analysisSource
) {
	let stats = null;
	if (analysisSource === 'wrapper') {
		stats = wrapperAnalysis.submissions.length
			? copyWrapperStats(wrapperAnalysis, assessmentCore)
			: initializeStats(assessmentCore, assessmentCore.preAnalysis);
	} else if (analysisSource === 'core') {
		stats = assessmentCore.analysis.submissions.length
			? copyCoreStats(assessmentCore.analysis, assessmentCore)
			: initializeStats(assessmentCore, assessmentCore.preAnalysis);
	}

	submissions.forEach((submission, index) => {
		const { subscriptions } = submission.user;
		const submission_ = cloneDeep(submission);
		submission_.user = submission.user._id;
		try {
			const meta = gradeSubmission(
				submission_,
				assessmentCore,
				wrapperAnalysis.bonus,
				0,
				getActivePhasesFromSubscriptions(subscriptions),
				assessmentWrapper.phases,
				assessmentWrapper.type
			);

			logger.info(
				`processing submission in gradeLib/gradeSubmissionsUpdateAssessment, submissionId: ${
					submission._id
				}, index: ${index} ${new Date()}`
			);

			Submission.update(
				{ _id: submission._id },
				{ $set: { meta, graded: true } }
			).exec();

			if (submission.ignore) {
				//
			} else {
				WrapperAnalyst.enqueueSubmissionData(
					{ meta, submissionId: submission._id, userId: submission_.user },
					wrapperAnalysis._id
				);
			}
		} catch (e) {
			logger.info(
				`Error occurred in gradeSubmissionsUpdateAssessment while grading (e && e.message) ||
					'Unknown error occurred in gradeSubmissionsUpdateAssessment \n ${e.stack}`
			);
		}
	});
	return { stats };
}

function gradeSubmissionUpdateAssessment(
	assessmentWrapper,
	assessmentCore,
	wrapperAnalysis,
	coreAnalysis,
	submission,
	phases,
	wrapperType
) {
	/* Required data
		assessmentCore -> question.question populated with answer and preAnalysis
		wrapperAnalysis._id, wrapperAnalysis.bonus, assessmentWrapper.phases, wrapperType
	*/
	const meta = gradeSubmission(
		submission,
		assessmentCore,
		wrapperAnalysis.bonus,
		0,
		phases,
		assessmentWrapper.phases,
		wrapperType
	);
	return meta;
}

function filterBonus(submission, bonuses) {
	const b1 = bonuses[submission.assessmentWrapper.toString()];
	const tt = new Date(submission.createdAt).getTime();
	const filteredBonus = {};
	Object.keys(b1).forEach((k) => {
		const bt = new Date(b1[k]).getTime();
		if (bt >= tt) {
			filteredBonus[k] = true;
		}
	});
	return filteredBonus;
}

function reGradeCore(assessmentCore, gradedSubmissions) {
	const stats = initializeStats(assessmentCore, assessmentCore.preAnalysis);

	const bonuses = {};

	assessmentCore.wrappers.forEach((wrapper) => {
		bonuses[wrapper.wrapper._id.toString()] = wrapper.wrapper.analysis.bonus;
	});

	gradedSubmissions.forEach((submission) => {
		const bonus = filterBonus(submission, bonuses);

		const meta = gradeAllSections(
			submission.response.sections,
			assessmentCore.sections,
			bonus,
			assessmentCore.markingScheme,
			assessmentCore.sectionGroups
		);
		// TODO: uncomment after debugging with Hitesh

		// this update looks useless
		// WrapperData.update(
		// 	{ 'data.submissionId': submission._id },
		// 	{ $set: { 'data.meta': meta } }
		// ).exec();

		submission.set('meta', meta);
		submission.markModified('meta');
		submission.save().then(() => {});

		const { correctQuestions, incorrectQuestions, sections, marks } = meta;

		stats.marks.push({
			_id: submission._id,
			marks,
			user: submission.user,
		});
		stats.hist = updateHistogram(stats.hist, marks, stats.maxMarks);
		if (correctQuestions + incorrectQuestions) {
			const accuracy =
				(1.0 * correctQuestions) / (correctQuestions + incorrectQuestions);
			stats.sumAccuracy += accuracy;
			stats.sumSqAccuracy += accuracy * accuracy;
		}

		sections.forEach((sec, secIndex) => {
			stats.sections[secIndex].hist = updateHistogram(
				stats.sections[secIndex].hist,
				sec.marks,
				stats.sections[secIndex].maxMarks
			);
		});
		stats.topper = getTopper(stats.topper, submission._id, meta);
		const data = updateSectionStats(
			stats.sections,
			stats.difficulty,
			sections,
			assessmentCore.sections,
			submission.user,
			'core'
		);
		stats.sections = data.sectionStats;
		stats.difficulty = data.difficultyStats;
		stats.sumMarks += marks;
	});
	stats.marks.sort((a, b) => b.marks - a.marks);
	return { stats };
}

module.exports = {
	gradeSubmission,
	reGradeCore,
	gradeSubmissionsUpdateAssessment,
	gradeSubmissionUpdateAssessment,
	gradeAllSections,
	/**
	 * getPartialMarkingCheckedResponse exported only for mocha test
	 */
	getPartialMarkingCheckedResponse,
};
