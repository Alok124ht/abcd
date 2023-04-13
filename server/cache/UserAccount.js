import UserAccountModel from '../user/useraccount.model';
import cacheManager from './cache-manager';

const memoryCache = cacheManager({
	max: 5000,
	ttl: 1 * 60 * 60,
});

const projection = {
	_id: 1,
	users: 1,
	email: 1,
	emailIdentifier: 1,
	defaultUser: 1,
};
const populate = [
	{
		path: 'users',
		select: 'subscriptions dp',
		populate: { path: 'subscriptions.subgroups.phases.phase', select: 'name' },
	},
];

// user account
const prefix = 'uac-';
// user account by user id
const userAccountByUserIdPrefix = 'uacbu-';

function getUserAccount(id, cacheCallback) {
	UserAccountModel.findById(id, projection)
		.populate(populate)
		.then((userAccount) => {
			if (userAccount) {
				cacheCallback(null, userAccount.toObject());
			} else {
				cacheCallback(null, userAccount);
			}
		})
		.catch((err) => {
			cacheCallback(err);
		});
}

export function get(id, cb) {
	const uniqueId = prefix + id;
	memoryCache.wrap(
		uniqueId,
		(cacheCallback) => {
			getUserAccount(id, cacheCallback);
		},
		(err1, userAccount) => {
			if (err1) cb(err1, userAccount);
			else {
				cb(null, userAccount);
			}
		}
	);
}

function getUserAccountByUserId(userId, cacheCallback) {
	UserAccountModel.findOne({ users: userId }, projection)
		.populate(populate)
		.then((userAccount) => {
			if (userAccount) {
				cacheCallback(null, userAccount.toObject());
			} else {
				cacheCallback(null, userAccount);
			}
		})
		.catch((err) => cacheCallback(err));
}

export function getByUserId(userId, cb) {
	const key = `${userAccountByUserIdPrefix}${userId}`;
	memoryCache.get(key, (error, userAccountId) => {
		if (error || !userAccountId) {
			getUserAccountByUserId(userId, (errorFromDb, userAccountFromDb) => {
				if (errorFromDb && userAccountFromDb) {
					cb(errorFromDb, userAccountFromDb);
					for (let index = 0; index < userAccountFromDb.users.length; index += 1) {
						const userIdItem = userAccountFromDb.users[index];
						memoryCache.set(
							`${userAccountByUserIdPrefix}${userIdItem}`,
							userAccountFromDb._id
						);
					}
					memoryCache.set(`${prefix}${userAccountFromDb._id}`, userAccountFromDb);
				} else {
					cb(errorFromDb, userAccountFromDb);
				}
			});
		} else {
			get(userAccountId, cb);
		}
	});
}

export function del(id) {
	const uniqueId = prefix + id;
	memoryCache.del(uniqueId);
}
