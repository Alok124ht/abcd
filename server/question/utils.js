const levelBasedTimeUpperLimitsHard = {
	1: 600,
	2: 660,
	3: 720,
};

const levelBasedTimeLowerLimitsHard = {
	1: 5,
	2: 10,
	3: 15,
};

const levelBasedSlowBias = {
	// time in seconds
	1: { time: 80, count: 5 },
	2: { time: 130, count: 5 },
	3: { time: 180, count: 5 },
};

const levelBasedFastBias = {
	// time in seconds
	1: {
		time: 5,
		count: 50,
	},
	2: {
		time: 15,
		count: 40,
	},
	3: {
		time: 30,
		count: 30,
	},
};
const timeFilter = (time, level) => {
	const timeUpperLimit = levelBasedTimeUpperLimitsHard[level];
	const timeLowerLimit = levelBasedTimeLowerLimitsHard[level];
	return time <= timeUpperLimit && time >= timeLowerLimit;
};

const calculateStats = (list) => {
	if (!list || list.length === 0) {
		return { mean: 0 };
	}
	let xbar = 0;
	const count = list.length;
	list.forEach((t) => {
		xbar += t;
	});

	const mean = xbar / count;

	return { mean };
};

const getPercentItemsFromList = (list, fromPercent, toPercent) => {
	const { length } = list;
	const end = Math.ceil((length * toPercent) / 100);
	const start = Math.floor((length * fromPercent) / 100);
	return list.slice(start, end);
};

const getPerfectTimeLimits = ({ attempts, level }) => {
	const reliableAttempts = attempts.filter((attempt) =>
		timeFilter(attempt.time, level)
	);

	const correctReliableAttempts = reliableAttempts.filter(
		(attempt) => attempt.isCorrect
	);

	const ascSortedCorrectReliableAttempts = correctReliableAttempts.sort(
		(a, b) => a.time - b.time
	);
	const ascSortedCorrectReliableAttemptTimeList = ascSortedCorrectReliableAttempts.map(
		(a) => a.time
	);

	const fastAttempts = getPercentItemsFromList(
		ascSortedCorrectReliableAttemptTimeList,
		0,
		10
	);
	const fastStats = calculateStats(fastAttempts);
	const fastBias = levelBasedFastBias[level];

	const fastCutOffTime =
		// eslint-disable-next-line no-mixed-operators
		(fastBias.count * fastBias.time + fastAttempts.length * fastStats.mean) /
		(fastBias.count + fastAttempts.length);

	const slowAttempts = getPercentItemsFromList(
		ascSortedCorrectReliableAttemptTimeList,
		30,
		85
	);

	const slowStats = calculateStats(slowAttempts);
	const slowBias = levelBasedSlowBias[level];

	const slowCutOffTime =
		// eslint-disable-next-line no-mixed-operators
		(slowBias.count * slowBias.time + slowAttempts.length * slowStats.mean) /
		(slowBias.count + slowAttempts.length);

	let medianTime = 0.5 * (slowCutOffTime + fastCutOffTime);

	if (ascSortedCorrectReliableAttemptTimeList.length) {
		medianTime =
			ascSortedCorrectReliableAttemptTimeList[
				Math.floor(ascSortedCorrectReliableAttemptTimeList.length / 2)
			];
	}

	return {
		max: slowCutOffTime,
		min: fastCutOffTime,
		medianTime,
	};
};

const getLevel = (attempts, minTime) => {
	const filteredAttempts = attempts.filter((attempt) => attempt.time > minTime);
	let correct = 0;
	let total = 0;
	filteredAttempts.forEach((attempt) => {
		if (attempt.isAnswered) total += 1;
		if (attempt.isAnswered && attempt.isCorrect) correct += 1;
	});
	if (correct > 0.75 * total) return 1;
	if (correct > 0.5 * total) return 2;
	return 3;
};

const calculateAndUpdateStatsForQuestion = (question, callback) => {
	const { attempts } = question.toObject().stats;
	const { level } = question;
	let correctOption = null;
	question.options.forEach((option) => {
		if (option.isCorrect) {
			correctOption = option._id.toString();
		}
	});
	const calculatedTimeStatsForAttempts = getPerfectTimeLimits({
		attempts: attempts.map((attempt) => ({
			time: attempt.time,
			isCorrect: attempt.option === correctOption,
		})),
		level,
	});
	question.set(
		'stats.computedStats.perfectTimeLimits',
		calculatedTimeStatsForAttempts
	);
	question.set('stats.computedStats.basedOnAttemptsCount', attempts.length);
	question.save(
		(error) =>
			callback &&
			callback({
				error,
				data: {
					...calculatedTimeStatsForAttempts,
					id: question._id,
					level: question.level,
				},
			})
	);
};

const calculateAndUpdateStatsForQuestions = (questions) =>
	Promise.all(
		questions.map(
			(question) =>
				new Promise((resolve) => {
					calculateAndUpdateStatsForQuestion(question, resolve);
				})
		)
	);

const timePrior = {
	fast: {
		fastCorrect: 0.57,
		perfectCorrect: 0.29,
		slowCorrect: 0.14,
		fastIncorrect: 0.62,
		perfectIncorrect: 0.25,
		slowIncorrect: 0.13,
	},
	perfect: {
		fastCorrect: 0.2,
		perfectCorrect: 0.4,
		slowCorrect: 0.2,
		fastIncorrect: 0.33,
		perfectIncorrect: 0.5,
		slowIncorrect: 0.17,
	},
	slow: {
		fastCorrect: 0.14,
		perfectCorrect: 0.29,
		slowCorrect: 0.57,
		fastIncorrect: 0.28,
		perfectIncorrect: 0.28,
		slowIncorrect: 0.44,
	},
};

const accuracyPrior = {
	good: {
		fastCorrect: 0.5,
		perfectCorrect: 0.67,
		slowCorrect: 0.83,
		fastIncorrect: 0.5,
		perfectIncorrect: 0.33,
		slowIncorrect: 0.17,
	},
	bad: {
		fastCorrect: 0.33,
		perfectCorrect: 0.5,
		slowCorrect: 0.67,
		fastIncorrect: 0.33,
		perfectIncorrect: 0.5,
		slowIncorrect: 0.33,
	},
};

const categoryProbabilities = (category) => {
	let tooFastProb = 1;
	let optimumProb = 1;
	let tooSlowProb = 1;
	let correctProb = 1;
	let incorrectProb = 1;

	Object.keys(category).forEach((c) => {
		const n = category[c];
		if (c === 'correct-too-fast') {
			tooFastProb *= Math.pow(timePrior.fast.fastCorrect, n);
			optimumProb *= Math.pow(timePrior.perfect.fastCorrect, n);
			tooSlowProb *= Math.pow(timePrior.slow.fastCorrect, n);
			correctProb *= Math.pow(accuracyPrior.good.fastCorrect, n);
			incorrectProb *= Math.pow(accuracyPrior.bad.fastCorrect, n);
		} else if (c === 'correct-optimum') {
			tooFastProb *= Math.pow(timePrior.fast.perfectCorrect, n);
			optimumProb *= Math.pow(timePrior.perfect.perfectCorrect, n);
			tooSlowProb *= Math.pow(timePrior.slow.perfectCorrect, n);
			correctProb *= Math.pow(accuracyPrior.good.perfectCorrect, n);
			incorrectProb *= Math.pow(accuracyPrior.bad.perfectCorrect, n);
		} else if (c === 'correct-too-slow') {
			tooFastProb *= Math.pow(timePrior.fast.slowCorrect, n);
			optimumProb *= Math.pow(timePrior.perfect.slowCorrect, n);
			tooSlowProb *= Math.pow(timePrior.slow.slowCorrect, n);
			correctProb *= Math.pow(accuracyPrior.good.slowCorrect, n);
			incorrectProb *= Math.pow(accuracyPrior.bad.slowCorrect, n);
		}
		if (c === 'incorrect-too-fast') {
			tooFastProb *= Math.sqrt(Math.pow(timePrior.fast.fastIncorrect, n));
			optimumProb *= Math.sqrt(Math.pow(timePrior.perfect.fastIncorrect, n));
			tooSlowProb *= Math.sqrt(Math.pow(timePrior.slow.fastIncorrect, n));
			correctProb *= Math.pow(accuracyPrior.good.fastIncorrect, n);
			incorrectProb *= Math.pow(accuracyPrior.bad.fastIncorrect, n);
		} else if (c === 'incorrect-optimum') {
			tooFastProb *= Math.sqrt(Math.pow(timePrior.fast.perfectIncorrect, n));
			optimumProb *= Math.sqrt(Math.pow(timePrior.perfect.perfectIncorrect, n));
			tooSlowProb *= Math.sqrt(Math.pow(timePrior.slow.perfectIncorrect, n));
			correctProb *= Math.pow(accuracyPrior.good.perfectIncorrect, n);
			incorrectProb *= Math.pow(accuracyPrior.bad.perfectIncorrect, n);
		} else if (c === 'incorrect-too-slow') {
			tooFastProb *= Math.sqrt(Math.pow(timePrior.fast.slowIncorrect, n));
			optimumProb *= Math.sqrt(Math.pow(timePrior.perfect.slowIncorrect, n));
			tooSlowProb *= Math.sqrt(Math.pow(timePrior.slow.slowIncorrect, n));
			correctProb *= Math.pow(accuracyPrior.good.slowIncorrect, n);
			incorrectProb *= Math.pow(accuracyPrior.bad.slowIncorrect, n);
		}
	});

	const sumSpeedProb = tooFastProb + optimumProb + tooSlowProb;
	if (sumSpeedProb > 0) {
		tooFastProb /= sumSpeedProb;
		optimumProb /= sumSpeedProb;
		tooSlowProb /= sumSpeedProb;
	} else {
		tooFastProb = 0.33;
		optimumProb = 0.34;
		tooSlowProb = 0.33;
	}

	const sumAccuractProb = correctProb + incorrectProb;
	if (sumAccuractProb > 0) {
		correctProb /= sumAccuractProb;
		incorrectProb /= sumAccuractProb;
	} else {
		correctProb = 0.5;
		incorrectProb = 0.5;
	}

	return { tooFastProb, optimumProb, tooSlowProb, correctProb, incorrectProb };
};

const randomPoissonNumber = (lambda) => {
	if (lambda < 3) lambda = 3;
	const L = Math.exp(-lambda); // + 0.3 * Math.exp(-3);
	let p = 1.0;
	let k = 0;
	do {
		k += 1;
		p *= Math.random();
	} while (p > L);
	return k - 1;
};

const getKeyForFilter = (filterOrQuestion, noLevel) => {
	const { level, subTopic } = filterOrQuestion;
	let key = subTopic;
	if (noLevel || parseInt(level, 10) === -1 || isNaN(parseInt(level, 10))) {
		key = `${key}+-1`;
	} else {
		key = `${key}+${level}`;
	}
	return key;
};

const selectFilter = (session) => {
	const filterCounts = {};
	let maxCount = 0;
	session.filters.forEach((filter) => {
		const key = getKeyForFilter(filter);
		filterCounts[key] = 0;
	});
	session.questions.forEach((question) => {
		let key = getKeyForFilter(question);
		if (!filterCounts[key] && filterCounts[key] !== 0) {
			// shouldn't it be filterCounts[key]
			key = getKeyForFilter(question, true);
		}
		if (isNaN(parseInt(filterCounts[key], 10))) {
			filterCounts[key] = 0;
		}
		filterCounts[key] += 1;

		maxCount = Math.max(maxCount, filterCounts[key]);
	});
	let sumProbs = 0;
	Object.keys(filterCounts).forEach((k) => {
		filterCounts[k] = maxCount + 1 - filterCounts[k]; // eslint-disable-line no-mixed-operators
		sumProbs += filterCounts[k];
	});
	const diceScore = Math.random() * sumProbs;
	let selectedFilter = '';
	let countSum = 0;
	Object.keys(filterCounts).forEach((k) => {
		countSum += filterCounts[k];
		if (selectedFilter === '' && countSum >= diceScore) {
			selectedFilter = k;
		}
	});
	return selectedFilter;
};

const getFilterIdx = (filters, counts, subTopic) => {
	const newFilters = [];
	filters.forEach((f, i) => {
		if (f.subTopic === subTopic) {
			newFilters.push({
				idx: i,
				count: counts[i],
			});
		}
	});
	let minCountIdx = -1;
	let minCountVal = 100000;
	newFilters.forEach((f) => {
		if (f.count < minCountVal) {
			minCountVal = f.count;
			minCountIdx = f.idx;
		}
	});
	return minCountIdx;
};

const selectFilterNucleus = (session) => {
	// console.log('selecting filter from nucleus');
	const filterCounts = session.filters.map((filter) => 0);
	let maxCount = 0;
	session.questions.forEach((question) => {
		const minCountIdx = getFilterIdx(
			session.filters,
			filterCounts,
			question.subTopic
		);

		// console.log('check minCounIdx', minCountIdx);
		filterCounts[minCountIdx] += 1;

		maxCount = Math.max(maxCount, filterCounts[minCountIdx]);
	});

	// console.log('check filter counts', filterCounts, maxCount);

	let sumProbs = 0;
	const newFilterCounts = filterCounts.map((filterCount) => {
		sumProbs += maxCount + 1 - filterCount;
		return maxCount + 1 - filterCount;
	});
	// console.log('check filter counts2', newFilterCounts);
	const diceScore = Math.random() * sumProbs;
	let selectedFilter = '';
	let countSum = 0;
	newFilterCounts.forEach((filterCount, idx) => {
		countSum += filterCount;
		if (selectedFilter === '' && countSum >= diceScore) {
			selectedFilter = session.filters[idx];
		}
	});
	return {
		sub_topic: selectedFilter.subTopic,
		level: { $in: selectedFilter.levels },
	};
};

/*
Test
const category_ = {
	'correct-too-fast': 1,
	'correct-optimum': 2,
	'correct-too-slow': 3,
	'incorrect-too-fast': 3,
	'incorrect-optimum': 2,
	'incorrect-too-slow': 1
}

zz = categoryProbabilities(category_)

*/

const getDataLevel = (topics, subtopic) => {
	const dataLevelMap = {};
	topics.forEach((t) => {
		t.sub_topics.forEach((st) => {
			dataLevelMap[st._id] = st.dataLevel;
		});
	});
	// console.log('check datalevel', dataLevelMap);
	// console.log('check subTopic', subtopic);
	return dataLevelMap[subtopic] ? dataLevelMap[subtopic] : 100;
};

const getDifficulty = (question) => {
	if (question.level === 1) {
		return 'easy';
	}
	if (question.level === 2) {
		return 'medium';
	}
	if (question.level === 3) {
		return 'hard';
	}
	return null;
};

module.exports = {
	calculateAndUpdateStatsForQuestion,
	calculateAndUpdateStatsForQuestions,
	categoryProbabilities,
	getDataLevel,
	getLevel,
	getDifficulty,
	getPerfectTimeLimits,
	selectFilter,
	selectFilterNucleus,
	randomPoissonNumber,
};
