const Bottleneck = require('bottleneck');
const Activity = require('../log/activity.model');
const ActivityCache = require('../cache/Activity');
const Session = require('../session/session.model').default;
const endSession = require('../session/lib/end');

class ActivityAndSessionManager {
	// only update activity once a day
	constructor() {
		// this.attemptQueue = [];
		this.activityLimiter = new Bottleneck({
			maxConcurrent: 1,
			minTime: 50,
		});
		this.sessionLimiter = new Bottleneck({
			maxConcurrent: 1,
			minTime: 60 * 1000,
		});
	}

	processActivity(id) {
		ActivityCache.getWithoutDb(id, function (err, activity) {
			if (activity) {
				const dateNow = new Date().getTime();
				if (activity < dateNow - 24 * 3600 * 1000) {
					// one day has been passed
					ActivityCache.set(id, dateNow, function (err, result) {
						this.activityLimiter
							.schedule(() => Activity.increment(id))
							.then((result) => {
								/* handle result */
							});
					});
				}
			} else {
				const dateNow = new Date().getTime();
				ActivityCache.set(id, dateNow, function (err, result) {
					this.activityLimiter
						.schedule(() => Activity.increment(id))
						.then((result) => {
							/* handle result */
						});
				});
			}
		});
	}

	endSession_(id, date) {
		Session.findOne({
			user: id,
			hasEnded: false,
			updatedAt: { $lt: date },
		}).then((session) => {
			// console.log('ending this session', session);
			if (session) {
				endSession(session, id);
			}
		});
	}

	processSession(id, date) {
		this.sessionLimiter.schedule(() => this.endSession_(id, date));
	}
}

module.exports = new ActivityAndSessionManager();
