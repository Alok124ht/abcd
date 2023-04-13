const findQuestion = (session, questionId) => {
	let question = null;
	let attempt = null;
	let questionIndex = -1;
	let statistics = null;
	session.questions.forEach((q, index) => {
		// question.id is populated with question
		if (q.question._id.equals(questionId)) {
			question = q.question;
			attempt = q.attempt;
			questionIndex = index;
			if (q && q.question && q.question.statistics) {
				statistics = q.question.statistics;
			}
		}
	});
	return { question, attempt, questionIndex, statistics };
};

const findActiveQuestion = (session) => {
	let activeQuestion = null;
	let activeQuestionIndex = -1;
	session.questions.some((question, index) => {
		const { attempt } = question;
		activeQuestionIndex = index;
		if (
			Array.isArray(attempt.flow) &&
			attempt.flow.length === 0 &&
			attempt.startTime &&
			!attempt.endTime
		) {
			activeQuestion = question;

			return true;
		} else if (Array.isArray(attempt.flow) && attempt.flow.length > 0) {
			const lastFlowItem = attempt.flow[attempt.flow.length - 1];
			if (lastFlowItem.startTime && !lastFlowItem.endTime) {
				activeQuestion = question;

				return true;
			}
		}
		return false;
	});
	if (!activeQuestion) {
		return null;
	}
	return {
		attempt: activeQuestion.attempt,
		question: activeQuestion.question,
		questionIndex: activeQuestionIndex,
	};
};

const calculateTimeTakenInAttempt = (attempt) => {
	if (Array.isArray(attempt.flow) && attempt.flow.length > 0) {
		return Math.floor(
			attempt.flow.reduce((accumulate, flowItem) => {
				if (flowItem.endTime) {
					return (
						accumulate + flowItem.endTime.getTime() - flowItem.startTime.getTime()
					);
				}
				return accumulate;
			}, 0) / 1000
		);
	} else if (attempt.endTime) {
		return Math.floor(
			(attempt.endTime.getTime() - attempt.startTime.getTime()) / 1000
		);
	}
	return 0;
};

const endFlowOfAttempt = (attempt, endTime) => {
	if (Array.isArray(attempt.flow) && attempt.flow.length > 0) {
		// eslint-disable-next-line no-param-reassign
		attempt.flow[attempt.flow.length - 1].endTime = endTime;
	} else {
		if (!Array.isArray(attempt.flow)) {
			// eslint-disable-next-line no-param-reassign
			attempt.flow = [];
		}
		attempt.flow.push({
			startTime: attempt.startTime,
			endTime: endTime || Date.now(),
		});
		// eslint-disable-next-line no-param-reassign
	}
	// eslint-disable-next-line no-param-reassign
	attempt.startTime = null;
	// eslint-disable-next-line no-param-reassign
	attempt.time = calculateTimeTakenInAttempt(attempt);
};
module.exports = {
	findActiveQuestion,
	findQuestion,
	endFlowOfAttempt,
	calculateTimeTakenInAttempt,
};
