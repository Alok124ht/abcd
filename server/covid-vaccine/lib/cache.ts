import moment, { Moment } from 'moment';
import { Types } from 'mongoose';
import { cacheDuration } from '../constants';
import VaccineInDistrictOnDateModel from '../models/VaccineInDistrictOnDate';

export async function getNonCachedDistrictDatePairs(
	districts: Types.ObjectId[],
	dates: Moment[]
): Promise<
	{
		district: Types.ObjectId;
		dates: Moment[];
	}[]
> {
	const items = await VaccineInDistrictOnDateModel.find({
		district: { $in: districts },
		date: {
			$in: dates.map((date) => date.toDate()),
		},
		lastRefreshedAt: {
			$gte: moment().subtract(cacheDuration, 'milliseconds').toDate(),
		},
	});
	if (items.length === districts.length * dates.length) {
		return [];
	}
	const districtKey: { [key: string]: number } = {};
	const remainingItems: { district: Types.ObjectId; dates: Moment[] }[] = [];
	items.forEach((item) => {
		// remainingItems.push({ district: item.district, dates: [] });
		districtKey[item.getKey()] = remainingItems.length - 1;
	});

	districts.forEach((district) => {
		const districtNotFetchedDates: Moment[] = [];
		dates.forEach((date) => {
			// const key = VaccineInDistrictOnDateModel.getKey({ district, date });
			if (!districtKey[VaccineInDistrictOnDateModel.getKey({ district, date })]) {
				districtNotFetchedDates.push(date);
			}
		});
		if (districtNotFetchedDates.length) {
			remainingItems.push({ district: district, dates: districtNotFetchedDates });
		}
	});
	return remainingItems;
}
