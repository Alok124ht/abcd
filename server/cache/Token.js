const mongoose = require('mongoose');
const { size } = require('lodash');
const cacheManager = require('./cache-manager');

const cache = cacheManager({
	max: 5000,
	ttl: 24 * 60 * 60,
});

const projection = {
	isBlacklisted: 1,
};

const prefix = 't-';

function getFromDbIsTokenRevoked(token, cacheCallback) {
	const Token = mongoose.model('Token');
	Token.findOne({ token }, projection).exec((error, searchedToken) => {
		if (error || !searchedToken || searchedToken.isBlacklisted) {
			cacheCallback(null, true);
		} else {
			cacheCallback(null, false);
		}
	});
}

function isTokenRevoked(token, cb) {
	const uniqueId = prefix + token;
	cache.wrap(
		uniqueId,
		(cacheCallback) => {
			getFromDbIsTokenRevoked(token, cacheCallback);
		},
		cb
	);
}

function blacklist(jwt, userId, userAgent, options) {
	const uniqueId = prefix + jwt;
	cache.del(uniqueId);
	const Token = mongoose.model('Token');
	return Token.blacklist(jwt, userId, userAgent, options);
}

function blacklistAll(userId, currToken, cb) {
	const Token = mongoose.model('Token');
	Token.find({ user: userId, isBlacklisted: false })
		.then((tokens) => {
			tokens.forEach((token) => {
				const tokensToClearFromCache = [];
				if (token.token !== currToken) {
					const uniqueId = prefix + token.token;
					tokensToClearFromCache.push(uniqueId);
					// memoryCache.del(uniqueId);
					token.set('isBlacklisted', true);
					token.set('blackListedAt', Date.now());
					token.set('r', 'LAD');
					token.save(() => {});
				}
				if (size(tokensToClearFromCache) > 0) {
					cache.del(...tokensToClearFromCache, () => {});
				}
			});
			if (cb) {
				cb();
			}
		})
		.catch((error) => {
			if (cb) {
				cb(error);
			}
		});
}

function clearMany(tokens, cb) {
	const tokensToClearFromCache = [];
	tokens.forEach((token) => {
		const uniqueId = prefix + token;
		tokensToClearFromCache.push(uniqueId);
	});
	if (size(tokensToClearFromCache) > 0) {
		cache.del(tokensToClearFromCache, cb);
	} else {
		cb();
	}
}

module.exports = {
	isTokenRevoked,
	blacklist,
	blacklistAll,
	clearMany,
};
