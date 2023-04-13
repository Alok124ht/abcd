import { Types } from 'mongoose';
import cacheManager from '../../cache/cache-manager';
import Model, { AlertStatBase } from '../models/AlertStat';

const cache = cacheManager({
	max: 500,
	ttl: 10 * 60,
});

const projection = {
	alert: 1,
	key: 1,
};

const idPrefix = 'vas-';
const keyPrefix = 'vvue-';

function getKeyForId(id: any) {
	return `${idPrefix}${id}`;
}

function getKeyAlertKey(key: any) {
	return `${keyPrefix}${key}`;
}

async function getItemFromDb(
	id: Types.ObjectId | string | number
): Promise<AlertStatBase> {
	const query = { _id: id };
	return await Model.findOne(query, projection).then((item) => {
		return item.toObject();
	});
}

export async function getItem(
	id: Types.ObjectId | string | number | any
): Promise<AlertStatBase> {
	const key = getKeyForId(id);
	const itemFromCache = await cache.get(key);
	if (!itemFromCache) {
		const itemFromDb = await getItemFromDb(id);
		if (itemFromDb) {
			await cache.set(key, itemFromDb);
			await cache.set(getKeyAlertKey(itemFromDb.key), itemFromDb);
			return itemFromDb;
		} else {
			return null;
		}
	} else {
		return itemFromCache as AlertStatBase;
	}
}
