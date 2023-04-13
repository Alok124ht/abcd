const asc = (arr) => arr.sort((a, b) => a.marks - b.marks);

const quantile = (arr, q) => {
	if (!arr.length) return 0;
	const sorted = asc(arr);
	const pos = (sorted.length - 1) * q;
	const base = Math.floor(pos);
	const rest = pos - base;

	if (sorted[base + 1] !== undefined) {
		return (
			sorted[base].marks + rest * (sorted[base + 1].marks - sorted[base].marks)
		);
	}
	return sorted[base].marks;
};

export function secureWrapperAnalysis(wrapperAnalysis) {
	const securedWrapperAnalysis = {
		_id: wrapperAnalysis._id,
		bonus: wrapperAnalysis.bonus,
		marks: wrapperAnalysis.marks,
		hist: wrapperAnalysis.hist,
		topper: wrapperAnalysis.topper,
		sections: wrapperAnalysis.sections.map((section) => {
			section.times.sort();
			const meanTime = section.times.length
				? section.times[Math.floor(section.times.length / 2)]
				: 0;
			return {
				id: section.id,
				incorrect: section.incorrect,
				correct: section.correct,
				sumMarks: section.sumMarks,
				marks: section.marks,
				sumTime: section.sumTime,
				meanTime,
				hist: section.hist,
			};
		}),
		difficulty: wrapperAnalysis.difficulty,
		sumMarks: wrapperAnalysis.sumMarks,
		sumAccuracy: wrapperAnalysis.sumAccuracy,
		sumSqAccuracy: wrapperAnalysis.sumSqAccuracy,
		liveAttempts: wrapperAnalysis.liveAttempts,
		totalAttempts: wrapperAnalysis.totalAttempts,
		attemptsSynced: wrapperAnalysis.attemptsSynced,
		nintypercentile: quantile(wrapperAnalysis.marks, 0.9),
	};
	return securedWrapperAnalysis;
}
export function secureCoreAnalysis(coreAnalysis) {
	const easyTimes = coreAnalysis.difficulty.easy.times;
	easyTimes.sort();
	const meanTimeEasy = easyTimes.length
		? easyTimes[Math.floor(easyTimes.length / 2)]
		: 0;

	const mediumTimes = coreAnalysis.difficulty.medium.times;
	mediumTimes.sort();
	const meanTimeMedium = mediumTimes.length
		? mediumTimes[Math.floor(mediumTimes.length / 2)]
		: 0;

	const hardTimes = coreAnalysis.difficulty.hard.times;
	hardTimes.sort();
	const meanTimeHard = hardTimes.length
		? hardTimes[Math.floor(hardTimes.length / 2)]
		: 0;
	const securedCoreAnalysis = {
		_id: coreAnalysis._id,
		difficulty: {
			easy: {
				correct: coreAnalysis.difficulty.easy.correct,
				incorrect: coreAnalysis.difficulty.easy.incorrect,
				time: coreAnalysis.difficulty.easy.time,
				totalAttempts: coreAnalysis.difficulty.easy.totalAttempts,
				meanTime: meanTimeEasy,
			},
			medium: {
				correct: coreAnalysis.difficulty.medium.correct,
				incorrect: coreAnalysis.difficulty.medium.incorrect,
				time: coreAnalysis.difficulty.medium.time,
				totalAttempts: coreAnalysis.difficulty.medium.totalAttempts,
				meanTime: meanTimeMedium,
			},
			hard: {
				correct: coreAnalysis.difficulty.hard.correct,
				incorrect: coreAnalysis.difficulty.hard.incorrect,
				time: coreAnalysis.difficulty.hard.time,
				totalAttempts: coreAnalysis.difficulty.hard.totalAttempts,
				meanTime: meanTimeHard,
			},
		},
		marks: coreAnalysis.marks,
		hist: coreAnalysis.hist,
		maxMarks: coreAnalysis.maxMarks,
		sumMarks: coreAnalysis.sumMarks,
		sumAccuracy: coreAnalysis.sumAccuracy,
		sumSqAccuracy: coreAnalysis.sumSqAccuracy,
		sumPickingAbility: coreAnalysis.sumPickingAbility,
		sumSqPickingAbility: coreAnalysis.sumSqPickingAbility,
		totalAttempts: coreAnalysis.totalAttempts,
		sections: coreAnalysis.sections.map((section) => {
			section.times.sort();
			const meanTime1 = section.times.length
				? section.times[Math.floor(section.times.length / 2)]
				: 0;
			return {
				id: section.id,
				incorrect: section.incorrect,
				correct: section.correct,
				sumMarks: section.sumMarks,
				maxMarks: section.maxMarks,
				marks: section.marks,
				sumTime: section.sumTime,
				meanTime: meanTime1,
				hist: section.hist,
				questions: section.questions.map((question) => {
					question.times.sort();
					const meanTime = question.times.length
						? question.times[Math.floor(question.times.length / 2)]
						: 0;
					return {
						id: question.id,
						sumTime: question.sumTime,
						sumSqTime: question.sumSqTime,
						correctAttempts: question.correctAttempts,
						totalAttempts: question.totalAttempts,
						meanTime,
					};
				}),
			};
		}),
		nintypercentile: quantile(coreAnalysis.marks, 0.9),
	};
	return securedCoreAnalysis;
}
export function getRanking(stats, marks) {
	const tempMarks = stats.marks.sort((a, b) => b.marks - a.marks);
	let i;
	for (i = 0; i < tempMarks.length; i += 1) {
		if (tempMarks[i].marks <= marks) {
			i += 1;
			break;
		}
	}
	return {
		percent: Math.round((10000.0 * marks) / stats.maxMarks) / 100.0,
		percentile:
			Math.round((10000.0 * (stats.marks.length - i)) / stats.marks.length) /
			100.0,
		rank: i,
	};
}
export function selectQuestions(questions, count, subTopic, level) {
	const selectedQuestions = [];
	const remainingQuestions = [];
	for (let i = 0; i < questions.length; i += 1) {
		if (
			questions[i].sub_topic === subTopic &&
			questions[i].level === level &&
			count
		) {
			selectedQuestions.push(questions[i]);
			count -= 1;
		} else {
			remainingQuestions.push(questions[i]);
		}
	}
	return { selected: selectedQuestions, remaining: remainingQuestions };
}

export function getCorrectOptions(options, multi) {
	const optionsRes = ['A', 'B', 'C', 'D'];
	let result = [];
	for (let i = 0; i < options.length; i++) {
		if (options[i].isCorrect) {
			if (multi) {
				result.push(optionsRes[i]);
			} else {
				return optionsRes[i];
			}
		}
	}
	return result;
}
