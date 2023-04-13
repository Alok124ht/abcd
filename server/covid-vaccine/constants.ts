import { ENVIRONMENT } from '../../config/ENVIRONMENT';
import config from '../../config/config';

export const dateFormat = 'DD-MM-YYYY';

/**
 * Cache duration in milliseconds
 */
export const cacheDuration =
	(config.env === ENVIRONMENT.DEV ? 60 : 5) * 60 * 1000;

export const cronRuleString = '*/5 * * * *';

export const minAlertInterval = 6 * 60 * 60 * 1000;
