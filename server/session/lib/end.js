const { isEmpty } = require('lodash');
const { isAnswerCorrect } = require('../../lib');

const Userxp = require('../../user/userxp.model');
const { findActiveQuestion, endFlowOfAttempt } = require('../utils');

function endSession(session, userId) {
	session.set('endTime', Date.now());
	session.set('hasEnded', true);
	if (session.config.prevent.reattempt) {
		return session
			.save()
			.then(() => Promise.resolve({ session }))
			.catch(() =>
				Promise.resolve({
					errorCode: 500,
					message: 'Can not end session. Some error occurred',
				})
			);
	}
	const activeQuestion = findActiveQuestion(session);

	const checkAttemptsAndReward = () => {
		let xpToReward = 0;
		return Promise.all(
			session.questions.map(({ question, attempt }) => {
				const { answer } = attempt;
				const isAnswered = answer && !isEmpty(answer.data);
				let speed = 5;
				if (
					attempt.perfectTimeLimits &&
					attempt.time > attempt.perfectTimeLimits.max
				) {
					speed = 0;
				}
				if (
					attempt.perfectTimeLimits &&
					attempt.time < attempt.perfectTimeLimits.min
				) {
					speed = 10;
				}
				attempt.set('speed', speed);
				attempt.set('isAnswered', isAnswered);
				if (!isAnswered) {
					attempt.set('isSkipped', true);
				} else {
					const isCorrect = isAnswerCorrect(answer.data, question);
					attempt.set('isCorrect', isCorrect);
					xpToReward += isCorrect ? 5 : 0;
				}
				return new Promise((resolve, reject) => {
					attempt.save((error) => {
						if (error) {
							reject(error);
						} else {
							resolve();
						}
					});
				});
			})
		)
			.then(() => {
				session.set('xpEarned', xpToReward);
				return session.save().then(() =>
					Userxp.findOne({ user: userId })
						.then((userXp) => {
							try {
								userXp.xp.push({
									val: xpToReward,
									reference: session._id,
									onModel: 'Session',
									description: 'Practice session reward',
								});
								userXp.save();
								return Promise.resolve({
									session,
									userXp,
								});
								// res.send({ session, userXp });
							} catch (e) {
								return Promise.resolve({
									session,
									message: e.message,
									userXp,
								});
							}
						})
						.catch(() =>
							Promise.resolve({
								errorCode: 500,
								message: 'Can not end session. Some error occurred',
							})
						)
				);
			})
			.catch((error) =>
				Promise.resolve({
					message: error.message,
					m: 'Some error occurred',
				})
			);
	};
	if (activeQuestion) {
		const { attempt: activeAttempt } = activeQuestion;
		if (activeAttempt) {
			endFlowOfAttempt(activeAttempt, Date.now());
			return activeAttempt
				.save()
				.then(() => checkAttemptsAndReward())
				.catch(() =>
					Promise.resolve({
						errorCode: 500,
						message: 'Internal server error occurred while saving attempt.',
					})
				);
		}
	} else {
		return checkAttemptsAndReward();
	}
	return null;
}

module.exports = endSession;
