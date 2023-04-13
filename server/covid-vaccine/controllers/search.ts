import { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import moment, { Moment } from 'moment';
import { Request } from '../../types/Request';
import { fetchCentersByDistrictWithDateRange } from '../lib';
import { search } from '../lib/search';
import APIError from '../../helpers/APIError';
import { parseFilter } from '../utils/filter';
import { dateFormat } from '../constants';
import { getNonCachedDistrictDatePairs } from '../lib/cache';
import { getItem as getDistrictFromCache } from '../cache/district';
import VaccineCenterModel from '../models/VaccineCenter';
import logger from '../../../config/winston';
import { createLog } from '../cache/DistrictSearchLog';

export async function getCenters(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const filters = parseFilter(req.query);
		logger.info(`COVIDVACCINE-Search - Searched ${JSON.stringify(filters)}`);
		const fromMoment = moment(filters.from, dateFormat);
		const tillMoment = moment(filters.till, dateFormat);
		const allDates: Moment[] = [];
		const numberOfDays = tillMoment.diff(fromMoment, 'days');
		for (let i = 0; i < numberOfDays; i += 1) {
			allDates.push(
				moment(moment().format(dateFormat), dateFormat).add(i, 'days')
			);
		}
		const searchedCenters = await VaccineCenterModel.find({
			$or: [{ _id: { $in: filters.centers } }],
		});
		const allDistrictsById: { [district: string]: true } = {};
		searchedCenters.forEach((center) => {
			allDistrictsById[center.district.toString()] = true;
		});
		filters.districts.forEach((district) => {
			allDistrictsById[district.toString()] = true;
		});
		const allDistricts: Types.ObjectId[] = Object.keys(
			allDistrictsById
		).map((district) => Types.ObjectId(district));
		const districtDatePairs = await getNonCachedDistrictDatePairs(
			allDistricts,
			allDates
		);

		const statusByDistrict: {
			[district: string]: {
				minDate: string;
				maxDate: string;
				didSucceed: boolean;
				reason?: string;
			};
		} = {};
		const didNotFetchFor: Types.ObjectId[] = allDistricts.filter((district) => {
			return !districtDatePairs.some((pair) => pair.district.equals(district));
		});
		await Promise.all(
			districtDatePairs.map(async (pair) => {
				const maxDate = moment.max(pair.dates);
				const minDate = moment.min(pair.dates);
				const district = await getDistrictFromCache(pair.district);
				if (!district) {
					statusByDistrict[pair.district.toString()] = {
						minDate: minDate.format(dateFormat),
						maxDate: maxDate.format(dateFormat),
						didSucceed: false,
						reason: 'district not found',
					};
					return;
				}
				const didSucceed = await fetchCentersByDistrictWithDateRange(
					district.districtId,
					minDate,
					maxDate,
					pair.district
				);
				statusByDistrict[district._id] = {
					minDate: minDate.format(dateFormat),
					maxDate: maxDate.format(dateFormat),
					didSucceed,
				};
			})
		);
		const items = await search(filters);
		const allCenters = await VaccineCenterModel.find({
			$or: [
				{ _id: { $in: filters.centers } },
				{ district: { $in: filters.districts } },
			],
		});
		res.send({
			items,
			centers: allCenters,
			filters,
			allDistricts,
			statusByDistrict,
			districtDatePairs: districtDatePairs.map((pair) => {
				return {
					district: pair.district,
					dates: pair.dates.forEach((d) => d.format(dateFormat)),
				};
			}),
			didNotFetchFor,
		});
		createLog(filters);
	} catch (e) {
		next(new APIError(e, 422, true));
		logger.info(`COVID-19-search: Error occurred while searching, ${e.message}`);
		return;
	}
}
