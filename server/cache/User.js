const { cloneDeep } = require('lodash');
const User = require('../user/user.model').default;
const UserLiveAssessmentCache = require('./UserLiveAssessment');
const UserXpCache = require('./UserXp');
const cacheManager = require('./cache-manager');
const { getByUserId } = require('./UserAccount');

const memoryCache = cacheManager({
	max: 5000,
	ttl: 24 * 60 * 60,
});

const projection = {
	_id: 1, // we don't need this
	'subscriptions.group': 1,
	'subscriptions.subgroups.group': 1,
	'subscriptions.subgroups.phases.active': 1,
	'subscriptions.subgroups.phases.phase': 1,
	'subscriptions.subgroups.phases.isAccessGranted': 1,
	'subscriptions.subgroups.phases.revocationReason': 1,
};

const prefix = 'u-';

function getUser(id, cacheCallback) {
	User.findById(id, projection)
		.then(async (user) => {
			if (user) {
				getByUserId(user._id, (error, userAccount) => {
					cacheCallback(null, {
						...user.toObject(),
						userAccount: userAccount && userAccount._id,
					});
				});
			} else {
				cacheCallback(null, user);
			}
		})
		.catch((err) => {
			cacheCallback(err);
		});
}

function get(id, cb) {
	const uniqueId = prefix + id;
	memoryCache.wrap(
		uniqueId,
		(cacheCallback) => {
			getUser(id, cacheCallback);
		},
		(err1, user) => {
			if (err1) cb(err1, user);
			else {
				UserXpCache.get(id, (err2, xp) => {
					if (err2) {
						cb(err2, user);
					} else {
						const userClone = cloneDeep(user);
						userClone.netXp = { val: xp };
						cb(null, userClone);
					}
				});
			}
		}
	);
}

function getWithLiveAssessment(id, cb) {
	get(id, (err1, user) => {
		if (err1) {
			cb(err1);
		} else {
			UserLiveAssessmentCache.get(id, (err2, userLiveAssessment) => {
				if (err2) {
					cb(err2);
				} else {
					user.liveAssessment = userLiveAssessment;
					cb(null, user);
				}
			});
		}
	});
}

function del(id) {
	const uniqueId = prefix + id;
	memoryCache.del(uniqueId);
}

module.exports = {
	get,
	getWithLiveAssessment,
	del, // is it used?
};
