import { FilterQuery, Types } from 'mongoose';
import { isEmpty } from 'lodash';
import moment from 'moment';
import VaccineCenter from '../models/VaccineCenter';
import VaccineSessionModel, { VaccineSession } from '../models/VaccineSession';

export interface VaccineFilter {
	districts?: Types.ObjectId[];
	centers?: Types.ObjectId[];
	minAgeLimit?: number;
	from?: Date;
	till?: Date;
	vaccine?: string;
	minAvailableCapacity?: number;
}

export async function search(filters: VaccineFilter) {
	if (isEmpty(filters.districts) && isEmpty(filters.centers)) {
		throw new Error('Either districts or centers should be selected');
	}
	let centersToSearch: Types.ObjectId[] = filters.centers;
	if (isEmpty(filters.centers)) {
		// is centers exists, districts has no effect
		centersToSearch = (
			await VaccineCenter.find({
				district: { $in: filters.districts },
			})
		).map((vaccineCenter) => vaccineCenter._id);
	}
	const searchQuery: FilterQuery<VaccineSession> = {};
	searchQuery.center = { $in: centersToSearch };
	if (filters.minAgeLimit) {
		if (filters.minAgeLimit === 18) {
			searchQuery.minAgeLimit = { $lt: 45 };
		} else {
			searchQuery.minAgeLimit = { $gte: 45 };
		}
	}
	const now = moment();
	if (filters.from) {
		searchQuery.date = { $gte: moment.max(moment(filters.from), now).toDate() };
	} else {
		searchQuery.date = { $gte: now.toDate() };
	}
	if (filters.till) {
		searchQuery.date = { ...searchQuery.date, $lte: filters.till };
	}
	if (filters.vaccine) {
		searchQuery.vaccine = filters.vaccine;
	}
	if (typeof filters.minAvailableCapacity !== 'undefined') {
		searchQuery.availableCapacity = { $gte: filters.minAvailableCapacity };
	}
	const result = await VaccineSessionModel.find(searchQuery).populate({
		path: 'center',
		populate: 'district',
	});
	return result;
}
