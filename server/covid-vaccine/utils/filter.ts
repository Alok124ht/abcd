import moment from 'moment';
import { Types } from 'mongoose';
import { map } from 'lodash';
import { dateFormat } from '../constants';
import { VaccineFilter } from '../lib/search';

export function parseFilter(rawFilters: any): VaccineFilter {
	const {
		districts: districtIds,
		centers: centerIds,
		minAgeLimit,
		vaccine,
		from,
		till,
		minAvailableCapacity,
	}: {
		districts?: string[];
		centers?: string[];
		minAgeLimit?: string;
		vaccine: string;
		from: string;
		till: string;
		minAvailableCapacity: string;
	} = rawFilters;
	const fromMoment = moment(from, dateFormat);
	const filters: VaccineFilter = {
		districts: map(districtIds, (districtId) => Types.ObjectId(districtId)),
		centers: map(centerIds, (centerId) => Types.ObjectId(centerId)),
	};
	if (!from) {
		throw new Error('From is required');
	} else if (!fromMoment.isValid()) {
		throw new Error('From is invalid');
	}
	filters.from = fromMoment.toDate();
	const tillMoment = moment(till, dateFormat);
	if (!till) {
		throw new Error('Till is required');
	} else if (!tillMoment.isValid()) {
		throw new Error('Till is invalid');
	}

	filters.till = tillMoment.toDate();
	if (minAgeLimit) {
		const parsedMinAgeLimit = parseInt(minAgeLimit, 10);
		if (!Number.isNaN(parsedMinAgeLimit)) {
			filters.minAgeLimit = parsedMinAgeLimit;
		}
	}
	if (typeof vaccine === 'string' && vaccine) {
		filters.vaccine = vaccine;
	}

	if (minAvailableCapacity) {
		const parsedMinAvailableCapacity = parseInt(minAvailableCapacity, 10);
		if (!Number.isNaN(parsedMinAvailableCapacity)) {
			filters.minAvailableCapacity = parsedMinAvailableCapacity;
		}
	}
	return filters;
}
