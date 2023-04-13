import Bottleneck from 'bottleneck';
import moment, { Moment } from 'moment';
import nodeScheduler from 'node-schedule';
import { forEach, random } from 'lodash';
import Redis from 'redis';
import { fetchCentersByDistrictWithDateRange } from '.';
import { getItem } from '../cache/district';

import config from '../../../config/config';
import { getNonCachedDistrictDatePairs } from './cache';
import { getDistrictsWhereAlertsAreRequested } from './district';
import { cronRuleString, dateFormat } from '../constants';
import { ENVIRONMENT } from '../../../config/ENVIRONMENT';
import { findAndMatchVaccineAvailabilityPendingRequestsAndSendNotification } from './notification';
import logger from '../../../config/winston';
import { saveDistrictLogs } from '../cache/DistrictSearchLog';

const limiter = new Bottleneck({
	id: 'vaccine-data-refresh-1',
	datastore: 'redis',
	clientOptions: config.redis,
	Redis,
	highWater: 1,
	strategy: Bottleneck.strategy.LEAK,
	maxConcurrent: 1,
	timeout: (config.env === ENVIRONMENT.prod ? 10 : 0.5) * 60 * 1000,
});

const randomId = Math.round(Math.random() * 1000);

async function refreshData() {
	logger.info(`COVID-cron: SRID: ${randomId} refreshData called, `);
	const allDistrictsWhereAlertsAreRequested = await getDistrictsWhereAlertsAreRequested();
	logger.info(
		`COVID-19-cron: SRID: ${randomId} Refresh Data: ${allDistrictsWhereAlertsAreRequested.length} district(s) where alerts are requested`
	);
	const allDates: Moment[] = [];
	for (let i = 0; i < 28; i += 1) {
		allDates.push(moment(moment().format(dateFormat), dateFormat).add(i, 'days'));
	}
	const districtDatePairs = await getNonCachedDistrictDatePairs(
		allDistrictsWhereAlertsAreRequested,
		allDates
	);
	logger.info(
		`COVID-19-cron: SRID: ${randomId} Refresh Data: ${districtDatePairs.length} districts where data update is required`
	);
	await Promise.all(
		districtDatePairs.map(async (pair) => {
			const maxDate = moment.max(pair.dates);
			const minDate = moment.min(pair.dates);
			try {
				const district = await getItem(pair.district);
				try {
					await fetchCentersByDistrictWithDateRange(
						district.districtId,
						minDate,
						maxDate,
						pair.district
					);
					logger.info(
						`COVID-19-cron: SRID ${randomId} Refresh Data: fetched for ${district.districtId}`
					);
				} catch (e) {
					logger.info(
						`COVID-19-cron: SRID ${randomId} Refresh Data: failed to fetch for centers ${
							district.districtId
						} ${minDate}${maxDate} ${pair.district}. ${e && e.message}`
					);
				}
			} catch (e) {
				logger.info(
					`COVID-19-cron: SRID ${randomId} Refresh Data: failed to get district using getItem ${e.message}; ${minDate}${maxDate} ${pair.district}`
				);
			}
		})
	);

	logger.info(
		`COVID-19-cron: SRID: ${randomId} Refresh Data: data fetched, calling notification service`
	);

	await findAndMatchVaccineAvailabilityPendingRequestsAndSendNotification();
	logger.info(
		`COVID-19-cron: SRID: ${randomId} Refresh Data: COMPLETED EVERYTHING`
	);
}

function onCron() {
	logger.info(`COVID-19-cron: SRID: ${randomId} onCron called`);
	setTimeout(() => {
		limiter.schedule(() => refreshData());
	}, 10000 * Math.random());
	limiter.on('error', (error) => {
		logger.info(
			`COVID-19-cron: BottleckLimier.onError called ${error && error.message}`
		);
	});
	saveDistrictLogs();
}

export function setUpCron() {
	if (false) {
		logger.error('COVID-19-cron: setUpCron please');
	} else {
		logger.info(`COVID-19-cron: SRID: ${randomId} setup ${cronRuleString}`);
		nodeScheduler.scheduleJob(cronRuleString, onCron);
		logger.info(`COVID-19-cron: SRID: ${randomId} setup done`);
		if (config.env === ENVIRONMENT.DEV) {
			refreshData();
		}
	}
}
