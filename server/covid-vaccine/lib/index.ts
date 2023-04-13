import axios from 'axios';
import randomUseragent from 'random-useragent';
import { Types } from 'mongoose';
import moment, { Moment } from 'moment';
import { toLower } from 'lodash';
import VaccineCenter, { VaccineCenterBase } from '../models/VaccineCenter';
import VaccineSession, { VaccineSessionBase } from '../models/VaccineSession';
import { dateFormat } from '../constants';
import VaccineInDistrictOnDateModel from '../models/VaccineInDistrictOnDate';
import { getItem } from '../cache/district';
import logger from '../../../config/winston';
import VaccineCenterResponseItem from '../types/VaccineCenterResponseItem';
import { fillEmptySessions } from '../utils/vaccineSession';

// const cowinBaseApi = `https://cdn-api.co-vin.in/api/v2/appointment/sessions/public`;
const proxyBaseUrl =
	'https://ppjdej9j26.execute-api.ap-south-1.amazonaws.com/1';
const endpoints = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const getCowinDataBaseUrl = () => {
	const randomIndex = Math.floor(Math.random() * (endpoints.length - 1));
	const url = `${proxyBaseUrl}/${endpoints[randomIndex]}`;
	return url;
};

export async function fetchCentersByDistrictWithDateRange(
	districtNumId: number,
	from: Moment,
	till: Moment,
	district: Types.ObjectId | string
) {
	const numberOfWeeks = Math.ceil(till.diff(from, 'week', true));
	const numberOfDays = 7 * numberOfWeeks;
	const fetchTill = moment.max(till, from.clone().add(numberOfDays - 1, 'days'));
	let date = from;
	let failCount = 0;
	for (; date.isSameOrBefore(fetchTill); date = date.clone().add(7, 'days')) {
		try {
			const allDates = [];
			let tempD = date.clone();
			for (
				var i = 0;
				tempD.isSameOrBefore(date.clone().add(6, 'days'));
				tempD.add(1, 'days')
			) {
				allDates.push(
					moment(tempD.clone().add(i, 'days').format(dateFormat), dateFormat)
				);
			}
			await fetchCentersByDistrict(
				districtNumId,
				date.format(dateFormat),
				allDates.map((d) => d.format(dateFormat))
			);
			await VaccineInDistrictOnDateModel.bulkWrite(
				allDates.map((date) => {
					return {
						updateOne: {
							filter: { district, date: date.toDate() },
							update: {
								$set: {
									district,
									date: date.toDate(),
									lastRefreshedAt: new Date(),
								},
							},
							upsert: true,
						},
					};
				})
			);
		} catch (e) {
			logger.error(`COVID-19-fetch-centers: error-occurred ${e.message}`);
			failCount += 1;
		}
	}
	return !failCount;
}

async function fetchCentersByDistrict(
	districtId: number,
	fromDate: string,
	allDates: string[]
) {
	let response;
	const userAgent = randomUseragent.getRandom();
	const cowinBaseApi = getCowinDataBaseUrl();
	const url = `${cowinBaseApi}?district_id=${districtId}&date=${fromDate}`;
	logger.info(`loading for url: ${url}`);
	response = await axios(url, {
		headers: {
			'user-agent': userAgent,
		},
	});
	if (!response.data.success) {
		logger.error(`COVID-19: fetchCentersByDistrict ${response.data}`);
		throw new Error('Error occurred while fetching data');
	}
	const responseCenters: VaccineCenterResponseItem[] = fillEmptySessions(
		response.data.cowin.centers,
		allDates
	);
	const centers: VaccineCenterBase[] = [];
	const district = await getItem(districtId);
	if (!district) {
		logger.info(
			`district not found, district Id: ${districtId} - date:${fromDate}`
		);
	}
	await Promise.all(
		responseCenters.map(async (centerResponseItem) => {
			const center: VaccineCenterBase = {
				centerId: centerResponseItem.center_id,
				feeType: centerResponseItem.fee_type,
				blockName: centerResponseItem.block_name,
				pinCode: centerResponseItem.pincode,
				name: centerResponseItem.name,
				district: district._id,
			};
			centers.push(center);
		})
	);
	await VaccineCenter.bulkWrite(
		centers.map((center) => {
			return {
				updateOne: {
					filter: { centerId: center.centerId },
					update: { $set: center },
					upsert: true,
				},
			};
		})
	);
	const insertedVaccineCenters = await VaccineCenter.find({
		centerId: { $in: centers.map((center) => center.centerId) },
	});
	const vaccineCenterIdsByNumId: { [centerId: string]: Types.ObjectId } = {};
	insertedVaccineCenters.forEach((center) => {
		vaccineCenterIdsByNumId[center.centerId.toString()] = center._id;
	});
	const sessionItemsToBulkWrite: VaccineSessionBase[] = [];
	responseCenters.forEach((centerResponseItem) => {
		centerResponseItem.sessions.forEach((session) => {
			const vaccineSession: VaccineSessionBase = {
				availableCapacity: session.available_capacity,
				minAgeLimit: session.min_age_limit,
				slots: session.slots,
				date: moment(session.date, 'DD-MM-YYYY').toDate(),
				center: vaccineCenterIdsByNumId[centerResponseItem.center_id],
				vaccine: toLower(session.vaccine),
			};
			sessionItemsToBulkWrite.push(vaccineSession);
		});
	});

	// TODO: set doses to 0 for the centers whose data we do not receive from this response
	// search for all centers of a district
	// go through all dates, update all sessions whose data is missing
	// case: as told by Siri, data of Hyderabad was shown on our website but actually it was not available on cowin
	await VaccineSession.bulkWrite(
		sessionItemsToBulkWrite.map((session) => {
			return {
				updateOne: {
					filter: {
						center: session.center,
						date: session.date,
					},
					update: session,
					upsert: true,
				},
			};
		})
	);
	return response.data;
}
