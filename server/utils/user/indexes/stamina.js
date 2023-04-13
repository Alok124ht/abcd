const { isEmpty } = require('lodash');

function transformTimeToTimestamps(questionAttemptInfoArr) {
	const transformedQuestionAttemptInfoArr = [];
	let timeElapsed = 0;
	for (let i = 0; i < questionAttemptInfoArr.length; i += 1) {
		const attemptInfo = questionAttemptInfoArr[i];
		const curTimeSegment = attemptInfo.time / 1000;
		timeElapsed += curTimeSegment;

		const tranformedAttemptInfo = {
			time: Math.floor(timeElapsed),
			isAnswered: attemptInfo.isAnswered,
			question: attemptInfo.question,
		};
		transformedQuestionAttemptInfoArr.push(tranformedAttemptInfo);
	}
	return transformedQuestionAttemptInfoArr;
}

function getQuestionToTimeInfoListMap(questionAttemptInfoArr) {
	const questionToTimeInfoListMap = {};
	let prevTimestamp = 0;
	for (let i = 0; i < questionAttemptInfoArr.length; i += 1) {
		const attemptInfo = questionAttemptInfoArr[i];

		const questionId = attemptInfo.question;
		const currentTimestamp = Math.floor(attemptInfo.time);
		const timeDuration = attemptInfo.time - prevTimestamp;
		const timeInfo = {
			timeDuration,
			startTime: prevTimestamp,
			endTime: currentTimestamp,
		};

		if (questionId in questionToTimeInfoListMap) {
			const timeList = questionToTimeInfoListMap[questionId];
			timeList.push(timeInfo);
		} else {
			questionToTimeInfoListMap[questionId] = [timeInfo];
		}

		prevTimestamp = attemptInfo.time; // update previous time ticker
	}
	return questionToTimeInfoListMap;
}

function getMinuteToSpeedMap(questionToTimeInfoListMap) {
	const minuteToSpeedmap = {};

	// eslint-disable-next-line no-restricted-syntax,guard-for-in
	for (const questionId in questionToTimeInfoListMap) {
		const timeInfoList = questionToTimeInfoListMap[questionId];
		const totalTimeTaken = timeInfoList.reduce(
			(sumTime, timeInfo) => sumTime + timeInfo.timeDuration,
			0
		);

		timeInfoList.forEach((timeInfo) => {
			const startTime = timeInfo.startTime;
			const endTime = timeInfo.endTime;
			const startMinute = Math.floor(startTime / 60);
			const endMinute = Math.floor(endTime / 60);

			const minuteWiseSegments = [];
			if (endMinute === startMinute) {
				const duration = endTime - startTime;
				minuteWiseSegments.push({
					question: questionId,
					minute: startMinute,
					fractionOfQuesSolved: duration / totalTimeTaken,
				});
			} else {
				minuteWiseSegments.push(
					{
						question: questionId,
						minute: startMinute,
						fractionOfQuesSolved:
							((startMinute + 1) * 60 - startTime) / totalTimeTaken,
					},
					{
						question: questionId,
						minute: endMinute,
						fractionOfQuesSolved: ((endTime - endMinute) * 60) / totalTimeTaken,
					}
				);

				for (let itrMin = startMinute + 1; itrMin < endMinute; itrMin += 1) {
					minuteWiseSegments.push({
						question: questionId,
						minute: itrMin,
						fractionOfQuesSolved: 60 / totalTimeTaken,
					});
				}
			}
			minuteWiseSegments.forEach((segment) => {
				const minute = segment.minute;
				const speedIncrFraction = segment.fractionOfQuesSolved;
				if (minute in minuteToSpeedmap) {
					const parsed = parseInt(speedIncrFraction, 10);
					if (!isNaN(parsed)) {
						minuteToSpeedmap[minute] += parsed;
					} else {
						minuteToSpeedmap[minute] += 0;
					}
					// minuteToSpeedmap[minute] += speedIncrFraction;
				} else if (
					typeof speedIncrFraction !== 'number' ||
					(typeof speedIncrFraction === 'number' && isNaN(speedIncrFraction))
				) {
					const parsed = parseInt(speedIncrFraction, 10);
					if (!isNaN(parsed)) {
						minuteToSpeedmap[minute] = parsed;
					} else {
						minuteToSpeedmap[minute] = 0;
					}
				} else {
					minuteToSpeedmap[minute] = speedIncrFraction;
				}
			});
		});
	}

	return minuteToSpeedmap;
}

function getOverallDensity(minuteToSpeedmap) {
	const totalMinutes = Object.keys(minuteToSpeedmap).length;
	const sumSpeeds = Object.keys(minuteToSpeedmap).reduce((sum, minute) => {
		if (
			typeof minuteToSpeedmap[minute] !== 'number' ||
			isNaN(minuteToSpeedmap[minute])
		) {
			const parsedMinutes = parseInt(minuteToSpeedmap[minute], 10);
			if (isNaN(parsedMinutes)) {
				return sum;
			}
			return sum + parsedMinutes;
		}
		return sum + minuteToSpeedmap[minute];
	}, 0);
	let overallDensity = 0;
	if (totalMinutes > 0) {
		overallDensity = sumSpeeds / totalMinutes;
	}
	return overallDensity;
}

function getLengthToDensityInfoMap(
	minuteToSpeedmap,
	minLengthPercent,
	maxLengthPercent
) {
	const totalMinutes = Object.keys(minuteToSpeedmap).length;
	let minLength = Math.floor((totalMinutes * minLengthPercent) / 100);
	minLength = Math.max(1, minLength);
	const maxLength = Math.floor((totalMinutes * maxLengthPercent) / 100);

	const lengthToDensityInfoMap = {};
	for (let itrLength = minLength; itrLength <= maxLength; itrLength += 1) {
		let maxDensity = 0;
		let maxDensityStartTime = 0;
		let maxDensityEndTime = 0;

		let minDensity = 0;
		let minDensityStartTime = 0;
		let minDensityEndTime = 0;

		let startMinute = 0;
		let endMinute = itrLength - 1;
		while (endMinute < totalMinutes) {
			let sumSpeeds = 0;
			for (let itrMin = startMinute; itrMin <= endMinute; itrMin += 1) {
				sumSpeeds += minuteToSpeedmap[itrMin];
			}

			const density = sumSpeeds / itrLength;
			if (density > maxDensity) {
				maxDensity = density;
				maxDensityStartTime = startMinute;
				maxDensityEndTime = endMinute;
			}

			if (minDensity === 0) {
				minDensity = density;
				minDensityStartTime = startMinute;
				minDensityEndTime = endMinute;
			} else if (density < minDensity) {
				minDensity = density;
				minDensityStartTime = startMinute;
				minDensityEndTime = endMinute;
			}

			startMinute += 1;
			endMinute += 1;
		}

		lengthToDensityInfoMap[itrLength] = {
			maxDensity,
			maxDensityStartTime,
			maxDensityEndTime,
			minDensity,
			minDensityStartTime,
			minDensityEndTime,
		};
	}

	return lengthToDensityInfoMap;
}

function getMinMaxDensityInfoWithLengths(lengthToDensityInfoMap) {
	let maxDensity = 0;
	let maxDensityLength = 0;
	let maxDensityStartTime = 0;
	let maxDensityEndTime = 0;

	let minDensity = 0;
	let minDensityLength = 0;
	let minDensityStartTime = 0;
	let minDensityEndTime = 0;

	// eslint-disable-next-line guard-for-in,no-restricted-syntax
	for (const length in lengthToDensityInfoMap) {
		const curMaxDensity = lengthToDensityInfoMap[length].maxDensity;
		const curMaxDensityStartTime =
			lengthToDensityInfoMap[length].maxDensityStartTime;
		const curMaxDensityEndTime = lengthToDensityInfoMap[length].maxDensityEndTime;

		const curMinDensity = lengthToDensityInfoMap[length].minDensity;
		const curMinDensityStartTime =
			lengthToDensityInfoMap[length].minDensityStartTime;
		const curMinDensityEndTime = lengthToDensityInfoMap[length].minDensityEndTime;

		if (curMaxDensity > maxDensity) {
			maxDensity = curMaxDensity;
			maxDensityLength = length;
			maxDensityStartTime = curMaxDensityStartTime;
			maxDensityEndTime = curMaxDensityEndTime;
		}

		if (minDensity === 0) {
			minDensity = curMinDensity;
			minDensityLength = length;
			minDensityStartTime = curMinDensityStartTime;
			minDensityEndTime = curMinDensityEndTime;
		} else if (curMinDensity > 0 && minDensity > curMinDensity) {
			minDensity = curMinDensity;
			minDensityLength = length;
			minDensityStartTime = curMinDensityStartTime;
			minDensityEndTime = curMinDensityEndTime;
		}
	}

	const minMaxDensityInfoWithLengths = {
		maxDensity,
		maxDensityLength,
		maxDensityStartTime,
		maxDensityEndTime,
		minDensity,
		minDensityLength,
		minDensityStartTime,
		minDensityEndTime,
	};
	return minMaxDensityInfoWithLengths;
}

function getStats(questionAttemptInfoArr, assessmentDuration) {
	let densityStats = {};
	const transformedQuestionAttemptInfoArr = transformTimeToTimestamps(
		questionAttemptInfoArr
	);
	if (isEmpty(transformedQuestionAttemptInfoArr)) {
		return 0;
	}
	const totalAttemptTime =
		transformedQuestionAttemptInfoArr[
			transformedQuestionAttemptInfoArr.length - 1
		].time / 60;
	if (assessmentDuration < totalAttemptTime) {
		return null;
	}
	const questionToTimeInfoListMap = getQuestionToTimeInfoListMap(
		transformedQuestionAttemptInfoArr
	);

	const minuteToSpeedmap = getMinuteToSpeedMap(questionToTimeInfoListMap);

	const overallDensity = getOverallDensity(minuteToSpeedmap);

	const lengthToDensityInfoMap = getLengthToDensityInfoMap(
		minuteToSpeedmap,
		60, //20,
		80 //40
	);

	const minMaxDensityInfoWithLengths = getMinMaxDensityInfoWithLengths(
		lengthToDensityInfoMap
	);

	const maxDensity = minMaxDensityInfoWithLengths.maxDensity;
	const stamina = maxDensity === 0 ? 0 : overallDensity / (1 * maxDensity);

	densityStats = minMaxDensityInfoWithLengths;
	densityStats.stamina = stamina;

	return densityStats;
}

const calculateStaminaForSubmission = (submission, assessmentCore) => {
	const getQuestionIndex = (questionNumber, sectionNumber) => {
		let questionsInPrevSections = 0;
		assessmentCore.sections.forEach((section, index) => {
			if (index < sectionNumber) {
				questionsInPrevSections += section.questions.length;
			}
		});
		return questionsInPrevSections + questionNumber;
	};
	const flow = submission.flow.map((item) => ({
		question: getQuestionIndex(item.question, item.section),
		isAnswered: !isEmpty(item.response),
		time: item.time,
	}));
	/**
     10% of tolarance is given for submission
     */
	const assessmentDuration = assessmentCore.duration / 60;
	const tolarance = Math.min(Math.round(assessmentDuration * 0.1), 5);
	const stats = getStats(flow, assessmentDuration + tolarance);
	if (stats) {
		if (stats.stamina < 0) {
			console.log(submission._id);
		}
		return Math.floor(100 * stats.stamina);
	}
	if (stats === 0) {
		return 0;
	}
	return 50;
};

module.exports = { calculateStaminaForSubmission };
