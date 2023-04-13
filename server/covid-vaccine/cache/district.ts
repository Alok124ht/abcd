import { Types } from 'mongoose';
import cacheManager from '../../cache/cache-manager';
import Model from '../models/GeoDistrict';

const cache = cacheManager({
	max: 500,
	ttl: 60 * 60,
});

const projection = {
	districtId: 1,
	state: 1,
	name: 1,
};

const districtByIdPrefix = 'vvdis-';
const districtByNumIdPrefix = 'vvndis-';

function getKeyForDistrictId(key: any) {
	return `${districtByIdPrefix}${key}`;
}

function getKeyForDistrictNumId(key: any) {
	return `${districtByNumIdPrefix}${key}`;
}

async function getItemFromDb(id: Types.ObjectId | string | number) {
	const query = typeof id === 'number' ? { districtId: id } : { _id: id };
	return await Model.findOne(query, projection).then((item) => {
		if (!item) {
			return null;
		}
		return item.toObject();
	});
}

export async function getItem(id: Types.ObjectId | string | number) {
	const key = getKeyForDistrictId(id);
	const itemFromCache = await cache.get(key);
	if (!itemFromCache) {
		const itemFromDb = await getItemFromDb(id);
		if (itemFromDb) {
			await cache.set(key, itemFromDb);
			await cache.set(getKeyForDistrictNumId(itemFromDb.districtId), itemFromDb);
			return itemFromDb;
		} else {
			return null;
		}
	} else {
		return itemFromCache;
	}
}

async function getManyItems(ids: (Types.ObjectId | string)[]) {
	return await Model.find({ _id: { $in: ids } }, projection).then((items) => {
		const itemsById = {};
		items.forEach((phase) => {
			itemsById[phase._id] = phase.toObject();
		});
		const result = ids.map((id) => itemsById[id]);
		return result;
	});
}

export async function getMany(ids: (Types.ObjectId | string)[]) {
	const uniqueIds = ids.map((id) => getKeyForDistrictId(id));
	if (!uniqueIds.length) {
		return [];
	} else if (uniqueIds.length === 1) {
		const item = await getItem(ids[0]);
		return [item];
	} else {
		return await cache.wrap(...uniqueIds, async (cacheCallback) => {
			const items = await getManyItems(ids);
			cacheCallback(items);
		});
	}
}
