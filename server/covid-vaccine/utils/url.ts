import config from '../../../config/config';
import { VaccineFilter } from '../lib/search';

function getToQueryParams(filters: VaccineFilter) {
	let query = '';
	let isFirst = true;
	if (Array.isArray(filters.districts)) {
		filters.districts.forEach((district) => {
			query += `${isFirst ? '?' : '&'}districts=${district}`;
			isFirst = false;
		});
	}
	if (Array.isArray(filters.centers)) {
		filters.centers.forEach((center) => {
			query += `${isFirst ? '?' : '&'}centers=${center}`;
			isFirst = false;
		});
	}
	if (filters.vaccine) {
		query += `${isFirst ? '?' : '&'}vaccine=${filters.vaccine}`;
		isFirst = false;
	}
	if (filters.minAgeLimit) {
		query += `${isFirst ? '?' : '&'}minAgeLimit=${filters.minAgeLimit}`;
		isFirst = false;
	}
	return query;
}

export function getFilterUrl(filters: VaccineFilter) {
	return `https://www.prepleaf.com/covid-vaccine-availability-portal/${getToQueryParams(
		filters
	)}`;
}
