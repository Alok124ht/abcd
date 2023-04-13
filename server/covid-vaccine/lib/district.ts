import moment from 'moment';
import { Types } from 'mongoose';
import { minAlertInterval } from '../constants';
import VaccineAvailabilityNotificationRequestModel, {
	VaccineAvailabilityNotificationRequest,
} from '../models/VaccineAvailabilityNotificationRequest';

export async function getAllPendingVaccineAvailabilityNotificationRequests(
	select: any,
	populate: any
): Promise<VaccineAvailabilityNotificationRequest[]> {
	const now = moment().toDate();
	const requests = await VaccineAvailabilityNotificationRequestModel.find({
		$or: [
			{
				lastTriggeredAt: { $exists: false },
			},
			{
				lastTriggeredAt: {
					$lte: moment().subtract(minAlertInterval, 'milliseconds').toDate(),
				},
				$or: [
					{ timesTriggered: { $lte: 4 } },
					{ timesTriggered: { $exists: false } },
				],
			},
		],
		till: { $gte: now },
	})
		.select(select)
		.populate(populate);

	return requests;
}

export async function getDistrictsWhereAlertsAreRequested(): Promise<
	Types.ObjectId[]
> {
	const requests = await getAllPendingVaccineAvailabilityNotificationRequests(
		'centers districts',
		{ path: 'centers', select: 'district' }
	);

	const allDistrictsMap: { [key: string]: boolean } = {};
	const allDistricts: Types.ObjectId[] = [];
	requests.forEach((request) => {
		request.districts.forEach((district) => {
			if (!allDistrictsMap[district.toString()]) {
				allDistrictsMap[district.toString()] = true;
				allDistricts.push(district);
			}
		});
		request.centers.forEach((center) => {
			const district = center.district;
			if (district) {
				if (!allDistrictsMap[district.toString()]) {
					allDistrictsMap[district.toString()] = true;
					allDistricts.push(district);
				}
			}
		});
	});
	return allDistricts;
}
