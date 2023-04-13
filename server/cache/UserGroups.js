/**
 * This file is used for user to group mapping storage and accessibility
 */
const { map } = require('lodash');
const cacheManager = require('./cache-manager');
const UserToUserGroup = require('../models/UserToUserGroup').default;

const cache = cacheManager({
	max: 5000,
	ttl: 24 * 60 * 60,
});

const prefix = 'ug-';

const clear = (userId, callback) => {
	let cb = callback;
	if (!callback) {
		cb = () => {};
	}
	cache.del(`${prefix}${userId}`, cb);
};

const getGroupsOfUser = (userId, cb) =>
	new Promise((resolve, reject) => {
		cache.wrap(
			`${prefix}${userId}`,
			(cacheCallback) => {
				UserToUserGroup.find({ user: userId })
					.select('group')
					.exec((searchError, items) => {
						if (searchError) {
							cacheCallback(searchError);
						} else {
							cacheCallback(
								null,
								map(items, (item) => item.group.toString())
							);
						}
					});
			},
			(error, result) => {
				if (cb) {
					cb(error, result);
				} else if (error) {
					reject(error);
				} else {
					resolve(result);
				}
			}
		);
	});

module.exports = { clear, getGroupsOfUser };
