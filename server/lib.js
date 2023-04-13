const {
	difference,
	filter,
	forEach,
	get,
	isEmpty,
	map,
	size,
	some,
} = require('lodash');
const { questionTypeMap: newTypeMap } = require('./constants');
const { default: logger } = require('../config/winston');

function shuffle(array) {
	let currentIndex = array.length;

	let temporaryValue;
	let randomIndex;
	while (currentIndex !== 0) {
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}
	return array;
}

function getSecMaxMarks(section) {
	let maxMarks = 0;
	section.questions.forEach((question) => {
		maxMarks += question.correctMark;
	});
	if (size(section, ['questionGroups']) > 0) {
		forEach(get(section, 'questionGroups'), (questionGroup) => {
			const optionalQuestionIndex = questionGroup.questions[0];
			const optionalQuestionMarks =
				section.questions[optionalQuestionIndex].correctMark;
			const optionalQuestionCount =
				questionGroup.questions.length - questionGroup.selectNumberOfQuestions;
			const totalOptionalMarks = optionalQuestionMarks * optionalQuestionCount;
			if (optionalQuestionMarks < 0 || Number.isNaN(totalOptionalMarks)) {
				// if anything goes wrong, don't subtract the marks, just return and log it
				logger.error(
					`optoinalQuestion calculation went wrong; ${optionalQuestionMarks}, ${section._id}`
				);
				return;
			}
			maxMarks -= totalOptionalMarks;
		});
	}
	return maxMarks;
}

function getSectionOptionalQuestionCount(section) {
	let count = 0;
	forEach(section.questionGroups, (questionGroup) => {
		count +=
			questionGroup.questions.length - questionGroup.selectNumberOfQuestions;
	});
	return count;
}

function getMaxMarks(assessment) {
	let maxMarks = 0;
	const marksBySectionIndex = [];
	forEach(assessment.sections, (section) => {
		const sectionTotalMarks = getSecMaxMarks(section);
		maxMarks += sectionTotalMarks;
		marksBySectionIndex.push(sectionTotalMarks);
	});
	forEach(assessment.sectionGroups, (sectionGroup) => {
		const sectionsNotToConsider = filter(
			sectionGroup.sections,
			(sectionNumber, index) => index >= sectionGroup.selectNumberOfSections
		);
		forEach(sectionsNotToConsider, (sectionIndex) => {
			maxMarks -= marksBySectionIndex[sectionIndex];
		});
	});
	forEach(get(assessment, ['config', 'extraSections'], []), (sectionIndex) => {
		if (typeof marksBySectionIndex[sectionIndex] === 'number') {
			maxMarks -= marksBySectionIndex[sectionIndex];
		}
	});
	return maxMarks;
}

function getTotalQuestions(assessment) {
	let totalQuestion = 0;
	assessment.sections.forEach((section) => {
		totalQuestion += section.questions.length;
	});
	return totalQuestion;
}

function randnBm(min, max, skew) {
	let u = 0;
	let v = 0;
	while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
	while (v === 0) v = Math.random();
	let num = Math.sqrt(-4.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

	num = num / 10.0 + 0.5; // Translate to 0 -> 1
	if (num > 1 || num < 0) num = randnBm(min, max, skew); // resample between 0 and 1 if out of range
	num **= skew; // Math.pow(num, skew); // Skew
	num *= max - min; // Stretch to fill range
	num += min; // offset to min
	return num;
}

function initializeStats(assessmentCore, preAnalysis) {
	const stats = {};
	stats.marks = [];

	stats.hist = [0, 0, 0, 0, 0, 0];
	stats.topper = {};

	stats.sumAccuracy = preAnalysis ? preAnalysis.stats.sumAccuracy : 0;
	stats.sumSqAccuracy = preAnalysis ? preAnalysis.stats.sumSqAccuracy : 0;
	stats.sumPickingAbility = 0;
	stats.sumSqPickingAbility = 0;
	stats.difficulty = {
		easy: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0, times: [] },
		medium: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0, times: [] },
		hard: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0, times: [] },
	};
	let sumCorrectMarks = 0;
	let sumIncorrectMarks = 0;
	stats.sections = assessmentCore.sections.map((sec, i) => ({
		id: sec._id,
		name: sec.name,
		questions: sec.questions.map((que, j) => {
			let correctAttempts = 0;
			let totalAttempts = 0;
			let sumTime = 0;
			let sumSqTime = 0;
			if (preAnalysis) {
				correctAttempts =
					preAnalysis.stats.sections[i].questions[j].correctAttempts;
				totalAttempts = preAnalysis.stats.sections[i].questions[j].totalAttempts;
				sumTime = preAnalysis.stats.sections[i].questions[j].sumTime;
				sumSqTime = preAnalysis.stats.sections[i].questions[j].sumSqTime;

				sumCorrectMarks += (que.correctMark * correctAttempts) / 30.0;
				sumIncorrectMarks +=
					(que.incorrectMark * (totalAttempts - correctAttempts)) / 30.0;

				if (que.question.level === 1) {
					stats.difficulty.easy.correct += correctAttempts;
					stats.difficulty.easy.incorrect += totalAttempts - correctAttempts;
					stats.difficulty.easy.time += sumTime;
					stats.difficulty.easy.times.push(sumTime);
					stats.difficulty.easy.totalAttempts += totalAttempts;
				} else if (que.question.level === 2) {
					stats.difficulty.medium.correct += correctAttempts;
					stats.difficulty.medium.incorrect += totalAttempts - correctAttempts;
					stats.difficulty.medium.time += sumTime;
					stats.difficulty.medium.times.push(sumTime);
					stats.difficulty.medium.totalAttempts += totalAttempts;
				} else if (que.question.level === 3) {
					stats.difficulty.hard.correct += correctAttempts;
					stats.difficulty.hard.incorrect += totalAttempts - correctAttempts;
					stats.difficulty.hard.time += sumTime;
					stats.difficulty.hard.times.push(sumTime);
					stats.difficulty.hard.totalAttempts += totalAttempts;
				}
			}

			return {
				id: que.question._id.toString(),
				sumSqTime,
				sumTime,
				correctAttempts,
				totalAttempts,
				times: preAnalysis ? preAnalysis.stats.sections[i].questions[j].times : [],
			};
		}),
		incorrect: preAnalysis ? preAnalysis.stats.sections[i].incorrect : 0,
		correct: preAnalysis ? preAnalysis.stats.sections[i].correct : 0,
		sumMarks: 0,
		maxMarks: getSecMaxMarks(sec),
		marks: [],
		marksWithUser: [],
		sumTime: preAnalysis ? preAnalysis.stats.sections[i].sumTime : 0,
		times: preAnalysis ? preAnalysis.stats.sections[i].times : [],
		hist: [0, 0, 0, 0, 0, 0],
	}));

	const maxMarksExpected = Math.max(0, sumCorrectMarks - sumIncorrectMarks);

	stats.maxMarks = getMaxMarks(assessmentCore);

	if (preAnalysis) {
		for (let i = 0; i < 30; i += 1) {
			const randomMark = randnBm(0, maxMarksExpected, 1.2);
			stats.hist[
				Math.max(0, Math.min(5, Math.round((5 * randomMark) / stats.maxMarks)))
			] += 1;
		}
	}

	stats.sumMarks = 0;
	return stats;
}

function getTopper(topper, sId, meta) {
	let newTopper = { ...topper };
	if (!Object.keys(topper).length || topper.marks < meta.marks) {
		newTopper = {
			marks: meta.marks,
			data: [
				{
					_id: sId,
					sections: meta.sections.map((sec) => ({
						time: sec.time,
						marks: sec.marks,
						correct: sec.correct,
						incorrect: sec.incorrect,
					})),
				},
			],
		};
	} else if (topper.marks === meta.marks) {
		newTopper.data.push({
			_id: sId,
			sections: meta.sections.map((sec) => ({
				time: sec.time,
				marks: sec.marks,
				correct: sec.correct,
				incorrect: sec.incorrect,
			})),
		});
	}
	return newTopper;
}

function updateHistogram(hist, marks, maxMarks) {
	const newHist = [...hist];
	const place = Math.max(Math.min(Math.round((5 * marks) / maxMarks), 5), 0);
	newHist[place] += 1;
	return newHist;
}

function getCorrectAnswer(options) {
	let answer = '';
	options.forEach((option) => {
		if (option.isCorrect) answer = option._id;
	});
	return answer;
}

function todaysDateFunc(d) {
	return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
}

function getAttemptedQuestions(user) {
	const attemptedQuestions = [];
	user.stats.topics.forEach((topic) => {
		topic.sub_topics.forEach((subTopic) => {
			attemptedQuestions.push.apply(
				attemptedQuestions,
				subTopic.questions.map((question) => question.qid)
			);
		});
	});
	return attemptedQuestions;
}

function getTopicIndex(topics, topic) {
	let t = null;
	topics.forEach((topic_, index) => {
		if (topic_.id === topic) {
			t = index;
		}
	});
	return t;
}

function updateLastQuestionTime(user, qid, topic, sub_topic, sessionStartTime) {
	// useless now??
	const t = getTopicIndex(user.stats.topics, topic);
	if (t !== null) {
		user.stats.topics[t].last_activity.sub_topic = sub_topic;
		const st = getTopicIndex(user.stats.topics[t].sub_topics, sub_topic);
		if (st !== null) {
			const { last_activity: lastActivity } = user.stats.topics[t].sub_topics[st];
			if (lastActivity && lastActivity.qid.toString() === qid.toString()) {
				const diffTime =
					new Date().getTime() - new Date(lastActivity.startTime).getTime();
				const resetQuestionTime =
					sessionStartTime.getTime() > new Date(lastActivity.startTime).getTime();
				if (resetQuestionTime || diffTime > 3600000) {
					const startTime = new Date().toString();
					user.stats.topics[t].sub_topics[st].last_activity.startTime = startTime;
					user.markModified('stats.topics');
					user.save();
					return {
						time: startTime,
					};
				}
				user.markModified('stats.topics');
				user.save();
				return {
					time: lastActivity.startTime,
				};
			}
			const startTime = new Date().toString();
			user.stats.topics[t].sub_topics[st].last_activity = {
				qid,
				startTime,
			};
			user.markModified('stats.topics');
			user.save();
			return {
				time: startTime,
			};
		}
		const startTime = new Date().toString();
		user.stats.topics[t].sub_topics.push({
			id: sub_topic,
			percent_complete: 0,
			last_activity: {
				qid,
				startTime,
			},
			questions: [],
		});
		user.markModified('stats.topics');
		user.save();
		return {
			time: startTime,
		};
	}
	const startTime = new Date().toString();
	user.stats.topics.push({
		id: topic,
		percent_complete: 0,
		last_activity: { sub_topic },
		sub_topics: [
			{
				id: sub_topic,
				percent_complete: 0,
				last_activity: {
					qid,
					startTime,
				},
				questions: [],
			},
		],
	});
	user.markModified('stats.topics');
	user.save();
	return {
		time: startTime,
	};
}

function secureQuestion(question) {
	const sQuestion = {};
	sQuestion.content = question.content;
	sQuestion._id = question._id;
	sQuestion.topicId = question.topicId;
	sQuestion.topic = question.topic;
	sQuestion.dataType = question.dataType;
	sQuestion.options = question.options.map((option) => ({
		_id: option._id,
		content: option.content,
	}));
	try {
		sQuestion.perfectTimeLimits = question.stats.computedStats.perfectTimeLimits;
	} catch (e) {
		sQuestion.perfectTimeLimits = {};
	}
	sQuestion.reports = question.reports;
	return sQuestion;
}

function getUserResponse(topics, qid) {
	let userResponse = {};
	topics.forEach((topic) => {
		topic.sub_topics.forEach((subTopic) => {
			subTopic.questions.forEach((question) => {
				if (question.qid.toString() === qid) userResponse = question;
			});
		});
	});
	return userResponse;
}

function getCorrectOption(options) {
	let correctOption = '';
	options.forEach((op) => {
		if (op.isCorrect) {
			correctOption = op;
		}
	});
	return correctOption;
}

function isAnswerCorrect(answer, question) {
	let isCorrect = false;

	const newType = newTypeMap[question.type] || question.type;

	if (newType === 'MULTIPLE_CHOICE_SINGLE_CORRECT') {
		question.options.forEach((option) => {
			if (option.isCorrect && option._id.toString() == answer) {
				isCorrect = true;
			} else if (option.isAlternateCorrect && option._id.toString() == answer) {
				isCorrect = true;
			}
		});
		if (some(question.answers, (correctAnswer) => correctAnswer == answer)) {
			isCorrect = true;
		}
	} else if (newType === 'MULTIPLE_CHOICE_MULTIPLE_CORRECT') {
		if (Array.isArray(answer)) {
			isCorrect = true;
			question.multiOptions.forEach((o) => {
				if (o.isCorrect && answer.indexOf(o._id.toString()) === -1) {
					isCorrect = false;
				} else if (!o.isCorrect && answer.indexOf(o._id.toString()) !== -1) {
					isCorrect = false;
				}
			});
			if (!isCorrect) {
				let isAlternateCorrect = false;
				question.multiOptions.forEach((o) => {
					if (o.isAlternateCorrect && answer.indexOf(o._id.toString()) === -1) {
						isAlternateCorrect = false;
					} else if (
						!o.isAlternateCorrect &&
						answer.indexOf(o._id.toString()) !== -1
					) {
						isAlternateCorrect = false;
					}
				});

				if (
					some(question.answers, (correctAnswer) => {
						const correctAnswerStringArray = map(correctAnswer, (option) => {
							try {
								const s = option.toString();
								return s;
							} catch (e) {
								// TODO: report this if happens
								return null;
							}
						});
						return (
							isEmpty(difference(correctAnswerStringArray, answer)) &&
							isEmpty(difference(answer, correctAnswerStringArray))
						);
					})
				) {
					isCorrect = true;
				}
				isCorrect = isCorrect || isAlternateCorrect;
			}
		}
	} else if (newType === 'INTEGER') {
		const parsedAnswer = parseInt(answer, 10);
		if (parseInt(answer, 10) === question.integerAnswer) {
			isCorrect = true;
		} else if (
			some(question.answers, (correctAnswer) => correctAnswer === parsedAnswer)
		) {
			isCorrect = true;
		}
	} else if (newType === 'RANGE') {
		const response = parseFloat(answer, 10);
		if (response >= question.range.start && response <= question.range.end) {
			isCorrect = true;
		} else if (
			some(question.answers, (correctAnswer) => {
				try {
					return response >= correctAnswer.start && response <= correctAnswer.end;
				} catch (e) {
					return false;
				}
			})
		) {
			isCorrect = true;
		}
	} else if (newType === 'MATCH_THE_COLUMNS') {
		if (question.columns.col1.length !== answer.length) {
			return isCorrect;
		}
		isCorrect = true;
		question.columns.col1.forEach((c, idx) => {
			Object.keys(c.matches).forEach((m) => {
				if (answer[idx].indexOf(parseInt(m, 10)) === -1) {
					isCorrect = false;
				}
			});
			answer[idx].forEach((a) => {
				if (!c.matches[a]) {
					isCorrect = false;
				}
			});
		});
	}
	return isCorrect;
}

function isAnswered(answer) {
	if (answer === 0) return true;
	if (Array.isArray(answer) && !answer.length) {
		return false;
	}
	if (Array.isArray(answer)) {
		let answer_ = false;
		answer.forEach((a) => {
			if (!Array.isArray(a) || a.length) {
				answer_ = true;
			}
		});
		return answer_;
	}
	return !!answer;
}

module.exports = {
	shuffle,
	getSectionOptionalQuestionCount,
	getSecMaxMarks,
	getMaxMarks,
	initializeStats,
	getTopper,
	getTotalQuestions,
	updateHistogram,
	getCorrectAnswer,
	todaysDateFunc,
	getAttemptedQuestions,
	updateLastQuestionTime,
	secureQuestion,
	getUserResponse,
	getCorrectOption,
	getTopicIndex,
	isAnswerCorrect,
	isAnswered,
};
