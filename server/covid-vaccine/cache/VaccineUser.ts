import { Types } from 'mongoose';
import { getStrippedEmail } from '../../utils/user/email';
import cacheManager from '../../cache/cache-manager';
import Model, { VaccineUserBase } from '../models/VaccineUser';

const cache = cacheManager({
	max: 500,
	ttl: 10 * 60,
});

const projection = {
	email: 1,
	emailIdentifier: 1,
	name: 1,
	mobileNumber: 1,
};

const userByIdPrefix = 'vvu-';
const userByEmailPrefix = 'vvue-';

function getKeyForId(id: any) {
	return `${userByIdPrefix}${id}`;
}

function getKeyForEmail(email: any) {
	return `${userByEmailPrefix}${getStrippedEmail(email)}`;
}

async function getItemFromDb(
	id: Types.ObjectId | string | number
): Promise<VaccineUserBase> {
	const query = { _id: id };
	return await Model.findOne(query, projection).then((item) => {
		return item.toObject();
	});
}

export async function getItem(
	id: Types.ObjectId | string | number | any
): Promise<VaccineUserBase> {
	const key = getKeyForId(id);
	const itemFromCache = await cache.get(key);
	if (!itemFromCache) {
		const itemFromDb = await getItemFromDb(id);
		if (itemFromDb) {
			await cache.set(key, itemFromDb);
			await cache.set(getKeyForEmail(itemFromDb.emailIdentifier), itemFromDb);
			return itemFromDb;
		} else {
			return null;
		}
	} else {
		return itemFromCache as VaccineUserBase;
	}
}
