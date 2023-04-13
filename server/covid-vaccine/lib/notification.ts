import EmailTemplates from 'email-templates';
import { Types } from 'mongoose';
import EmailBounce from '../../models/EmailBounce';
import { sendEmail } from '../../utils/mail';
import { getItem } from '../cache/VaccineUser';
import VaccineAvailabilityNotificationRequestModel, {
	VaccineAvailabilityNotificationRequest,
} from '../models/VaccineAvailabilityNotificationRequest';
import { VaccineCenter } from '../models/VaccineCenter';
import { VaccineSession } from '../models/VaccineSession';
import { getDisplayableName } from '../utils/vaccineCenter';
import { getAllPendingVaccineAvailabilityNotificationRequests } from './district';
import { search } from './search';
import logger from '../../../config/winston';
import { getFilterUrl } from '../utils/url';
import { sendSMS } from '../../utils/sms';
import moment from 'moment';
import AlertStat from '../models/AlertStat';
import config from '../../../config/config';
import { ENVIRONMENT } from '../../../config/ENVIRONMENT';

async function notifyUser(
	request: VaccineAvailabilityNotificationRequest,
	sessions: VaccineSession[],
	alsoSendSMS: boolean
) {
	const alertStat = await AlertStat.getOrCreate(request._id);
	const centersById: { [centerId: string]: VaccineCenter } = {};
	sessions.forEach((session) => {
		centersById[session.center._id] = session.center;
	});
	const allCenters = Object.keys(centersById).map(
		(centerId) => centersById[centerId]
	);
	const moreCenterText =
		allCenters.length > 1
			? ` and ${allCenters.length - 1} other center${
					allCenters.length > 2 ? 's' : ''
			  }`
			: '';
	const availabilityMessage = `Vaccines are available at ${getDisplayableName(
		allCenters[0]
	)}${moreCenterText}.`;
	const centerSMSMText = `at ${getDisplayableName(
		allCenters[0],
		true,
		30 - moreCenterText.length
	)} ${moreCenterText}`;
	const user = await getItem(request.user);

	if (user) {
		const bouncedItem = await EmailBounce.findOne({ ei: user.emailIdentifier });
		if (!bouncedItem) {
			const emailTemplateClient = new EmailTemplates();
			const html = await emailTemplateClient.render('covid/center_found', {
				websiteLink: getFilterUrl(request.getFilters()),
				availabilityMessage,
			});
			sendEmail(
				{
					subject: 'Alert: COVID-19 Vaccine available now for you',
					to: [user.email],
					body: html,
					bodyType: 'Html',
				},
				() => {
					logger.info(`COVID-19-notification: Email sent to ${user.email}`);
				}
			);
			if (alsoSendSMS) {
				if (user.mobileNumber && user.mobileNumber.length === 10) {
					if (config.env !== ENVIRONMENT.DEV) {
						sendSMS(
							`91${user.mobileNumber}`,
							`COVID-19 Vaccine available ${centerSMSMText}. Visit prepleaf.com/c?${alertStat.key} to book your slot.\n\nTeam Prepleaf`
						);
					} else {
						console.log(alertStat.toObject());
					}
				}
			}
			logger.info(
				`COVID-19-notification: sending email to ${user.email}, ${JSON.stringify(
					user
				)}`
			);
		} else {
			logger.info(
				`COVID-19-notification: email bounced earlier, so not sending email to ${JSON.stringify(
					user
				)} ${user.emailIdentifier}`
			);
		}
	}
}

export async function findAndMatchVaccineAvailabilityPendingRequestsAndSendNotification(): Promise<void> {
	logger.info('COVID-19-notification: findAndMatchVaccineAvailability called');
	const pendingRequests = await getAllPendingVaccineAvailabilityNotificationRequests(
		'centers user state districts centers minAgeLimit from till vaccine minAvailableCapacity lastTriggeredAt lastMessageSentAt',
		{
			path: 'centers',
			select: 'name blockName district',
		}
	);
	logger.info(
		`COVID-19-notification: ${pendingRequests.length} requests pending`
	);
	const fulfilledRequests: Types.ObjectId[] = [];
	const smsIds: Types.ObjectId[] = [];
	try {
		await Promise.all(
			pendingRequests.map(async (request) => {
				try {
					const sessions = await search(request.getFilters());
					if (sessions.length) {
						logger.info('fulfilled request', request.toObject());
						let shouldSendSMS = request.lastMessageSentAt
							? moment(request.lastMessageSentAt).add(1, 'days').isBefore(new Date())
							: true;
						notifyUser(request, sessions, shouldSendSMS);
						logger.info(`COVID-19: notifyUser; request: ${JSON.stringify(request)}`);
						if (shouldSendSMS) {
							smsIds.push(request._id);
						}
						fulfilledRequests.push(request._id);
					} else {
						logger.info(
							'could not fulfill request',
							JSON.stringify(request.toObject())
						);
					}
				} catch (e) {
					logger.info(
						`COVID-19-notification: request match failed, ${
							e.message
						}, ${JSON.stringify(request.toObject())}`
					);
				} finally {
					// marking it as fulfilled even if some error occurred
				}
			})
		);
	} catch (e) {
		logger.info(`COVID-19-notification: some error occurred, ${e.message}`);
	}
	logger.info('done with this');
	logger.info(
		`COVID-19-notification: ${
			fulfilledRequests.length
		} requests marked Fulfilled. ${
			pendingRequests.length - fulfilledRequests.length
		} still Pending.`
	);
	try {
		await VaccineAvailabilityNotificationRequestModel.markFulfilled(
			fulfilledRequests,
			smsIds
		);
	} catch (e) {
		logger.error(`error occurred while saving marking fulfilled ${e.message}`);
	}
	return null;
}
