const { throttle } = require('lodash');
const Userxp = require('../user/userxp.model');
const UserLiveAssessment = require('../user/UserLiveAssessment').default;
const UserLiveAssessmentCache = require('../cache/UserLiveAssessment');

class UserManager {
	constructor() {
		this.assessmentRequests = [];
		this.throttledFn = throttle(this.processAssessmentRequests, 50, {
			trailing: true, // why trailing?
		});
	}

	enqueueAssessmentRequests(data) {
		this.assessmentRequests.push(data);
	}

	dequeueAssessmentRequests() {
		if (!this.assessmentRequests.length) {
			return null;
		}
		return this.assessmentRequests.shift();
	}

	processAssessmentRequests() {
		// get assessmentCore
		// console.log('Processing');
		const data = this.dequeueAssessmentRequests();
		if (this.assessmentRequests.length) {
			this.throttledProcessAssessmentRequests();
		}
		if (data) {
			const { userId, userXpId, wrapperId, timeNow, duration, xpVal } = data;

			// there is a chance that user's xp will be deducted multiple times
			Userxp.update(
				// optimize this??
				{ _id: userXpId },
				{
					$push: {
						xp: {
							val: xpVal,
							reference: wrapperId,
							onModel: 'Assessment',
							description: 'assessment attempt',
						},
					},
				}
			).then(() => {
				UserLiveAssessment.update(
					{ user: userId },
					{
						$set: {
							assessmentWrapperId: wrapperId,
							startTime: timeNow,
							duration,
							flow: [],
						},
					}
				).then((updateResult) => {
					if (updateResult.n) {
						UserLiveAssessmentCache.set(
							userId,
							{
								assessmentWrapperId: wrapperId,
								startTime: timeNow,
								duration,
								flow: [],
							},
							() => {}
						);
					}
				});
			});
		}
	}

	throttledProcessAssessmentRequests() {
		return this.throttledFn();
	}
}

module.exports = new UserManager();
