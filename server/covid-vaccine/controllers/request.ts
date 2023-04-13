import { NextFunction, Response } from 'express';
import { Request } from '../../types/Request';
import VaccineAvailabilityNotificationRequestModel, {
	VaccineAvailabilityNotificationRequest,
} from '../models/VaccineAvailabilityNotificationRequest';
import APIError from '../../helpers/APIError';
import { parseFilter } from '../utils/filter';
import { getOrRegisterUser } from '../lib/user';
import { FilterQuery } from 'mongoose';
import moment from 'moment';
import { getStrippedEmail } from '../../utils/user/email';
import VaccineUserModel, { VaccineUser } from '../models/VaccineUser';

export async function subscribe(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const filters = parseFilter(req.body);
		if (!filters.minAvailableCapacity) {
			filters.minAvailableCapacity = 1;
		}
		const defaultAlertTillMoment = moment().add(2, 'months');
		const vaccineUser = await getOrRegisterUser(req.body);
		const existingNotificationRequestQuery: FilterQuery<VaccineAvailabilityNotificationRequest> = {
			user: vaccineUser._id,
		};
		if (filters.vaccine) {
			existingNotificationRequestQuery.vaccine = filters.vaccine;
		} else {
			existingNotificationRequestQuery.vaccine = { $exists: false };
		}

		if (filters.minAgeLimit) {
			existingNotificationRequestQuery.minAgeLimit = filters.minAgeLimit;
		} else {
			existingNotificationRequestQuery.minAgeLimit = { $exists: false };
		}
		let request = await VaccineAvailabilityNotificationRequestModel.findOne(
			existingNotificationRequestQuery
		);
		if (!request) {
			request = new VaccineAvailabilityNotificationRequestModel(filters);
			request.user = vaccineUser._id;
			request.till = defaultAlertTillMoment.toDate();
		} else {
			filters.districts.forEach((district) => {
				if (!request.districts.some((d) => d.equals(district))) {
					request.districts.push(district);
				}
			});
			filters.centers.forEach((center) => {
				if (!request.centers.some((c) => c.equals(center))) {
					request.centers.push(center);
				}
			});
			if (moment(request.till).isBefore(defaultAlertTillMoment)) {
				request.till = defaultAlertTillMoment.toDate();
			}
			request.totalTimesTriggered = request.timesTriggered;
			request.timesTriggered = 0;
			request.lastTriggeredAt = undefined;
			request.lastMessageSentAt = undefined;
		}
		await request.save();
		res.send(request);
	} catch (e) {
		next(new APIError(e, 500, true));
		return;
	}
}

export async function getMyAlerts(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { email, mobileNumber: mobileNumberRaw } = req.query;
	if (typeof email !== 'string' && mobileNumberRaw !== 'string') {
		next(new APIError('Email Id or mobile number is required'));
		return;
	}
	const query: FilterQuery<VaccineUser> = {
		$or: [],
	};
	if (typeof email === 'string') {
		const emailIdentifier = getStrippedEmail(email);
		query.$or.push({ emailIdentifier });
	}
	if (typeof mobileNumberRaw === 'string') {
		query.$or.push({ mobileNumber: mobileNumberRaw });
	}
	const user = await VaccineUserModel.findOne(query);
	if (user) {
		const requests = await VaccineAvailabilityNotificationRequestModel.find({
			user: user._id,
		}).populate([
			{ path: 'centers', populate: { path: 'district', select: 'name' } },
			{ path: 'districts', select: 'name' },
		]);
		res.send({
			user: {
				_id: user._id,
				email: user.email,
			},
			items: requests.map((request) => request.toObject()),
		});
	} else {
		next(new APIError('User not registered', 422, true));
	}
}
