import logger from '../../../config/winston';
import { VaccineFilter } from '../lib/search';
import DistrictSearchLog from '../models/DistrictSearchLog';

let countByDistrictId: { [districtId: string]: number } = {};
export function createLog(filters: VaccineFilter) {
	const districts = filters.districts;
	try {
		districts.forEach((district) => {
			const stringId = district.toString();
			if (!countByDistrictId[stringId]) {
				countByDistrictId[stringId] = 0;
			}
			countByDistrictId[stringId] += 1;
		});
	} catch (e) {
		console.error(e);
	}
}

export async function saveDistrictLogs() {
	const countByDistrictIdLocal = countByDistrictId;
	countByDistrictId = {};
	const operations = Object.keys(countByDistrictIdLocal).map((districtId) => {
		return {
			updateOne: {
				filter: {
					district: districtId,
				},
				update: {
					$set: {
						district: districtId,
					},
					$inc: { count: countByDistrictIdLocal[districtId] },
				},
				upsert: 1,
			},
		};
	});
	try {
		await DistrictSearchLog.bulkWrite(operations);
	} catch (e) {
		logger.info(
			`COVID-19-search-log: Error occurred while saving district search logs, ${e.message}`
		);
	}
}
