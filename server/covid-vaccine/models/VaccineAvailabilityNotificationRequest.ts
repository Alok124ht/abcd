import { Schema, model, Model, Document, Types } from 'mongoose';
import { VaccineFilter } from '../lib/search';
import { VaccineUser } from './VaccineUser';

export const enum VaccineAvailabilityNotificationRequestState {
	CREATED = 'Created',
	FULFILLED = 'Fulfilled',
}
const vaccineAvailabilityNotificationRequestStateValues = [
	VaccineAvailabilityNotificationRequestState.CREATED,
	VaccineAvailabilityNotificationRequestState.FULFILLED,
];

const VaccineAvailabilityNotificationRequestSchama = new Schema(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'VaccineUser',
			required: true,
			index: true,
		},

		districts: [{ type: Schema.Types.ObjectId, ref: 'GeoDistrict' }],
		centers: [{ type: Schema.Types.ObjectId, ref: 'VaccineCenter' }],
		minAgeLimit: Number,
		from: { type: Date, index: true, required: true },
		till: { type: Date, index: true, required: true },
		vaccine: String,
		lastTriggeredAt: { type: Date },
		lastMessageSentAt: { type: Date },
		timesTriggered: { type: Number },
		totalTimesTriggered: { type: Number, default: 0 },
		timesSMSSent: { type: Number },
		minAvailableCapacity: {
			type: Number,
			index: true,
		},
		state: {
			type: String,
			required: true,
			index: true,
			enum: vaccineAvailabilityNotificationRequestStateValues,
			default: vaccineAvailabilityNotificationRequestStateValues[0],
		},
		stateHistory: [
			{
				value: {
					type: String,
					enum: vaccineAvailabilityNotificationRequestStateValues,
				},
				at: Date,
			},
		],
	},
	{ timestamps: true }
);

VaccineAvailabilityNotificationRequestSchama.method(
	'getFilters',
	function getFilters(this: VaccineAvailabilityNotificationRequest) {
		const filters: VaccineFilter = {};
		filters.centers = this.centers.map((center) => {
			if (center instanceof Document) {
				return center._id;
			} else {
				return center;
			}
		});
		filters.districts = this.districts.map((district) => {
			if (district instanceof Document) {
				return district._id;
			} else {
				return district;
			}
		});
		filters.from = this.from;
		filters.till = this.till;
		filters.minAgeLimit = this.minAgeLimit;
		filters.minAvailableCapacity = this.minAvailableCapacity;
		filters.vaccine = this.vaccine;
		return filters;
	}
);

VaccineAvailabilityNotificationRequestSchama.static(
	'markFulfilled',
	async function markFulfilled(
		this: VaccineAvailabilityNotificationRequestModel,
		ids: (Types.ObjectId | string | any)[],
		smsIds: (Types.ObjectId | string | any)[]
	) {
		const now = new Date();
		await this.updateMany(
			{ _id: { $in: smsIds } },
			{
				$inc: {
					timesSMSSent: 1,
					timesTriggered: 1,
				},
				$set: {
					lastTriggeredAt: now,
					lastMessageSentAt: now,
				},
			}
		);
		const nonSMSIds = ids.filter(
			(id) => !smsIds.some((smsId) => smsId.toString() === id.toString())
		);
		await this.updateMany(
			{
				_id: {
					$in: nonSMSIds,
				},
			},

			{
				$set: {
					lastTriggeredAt: now,
				},
				$inc: {
					timesTriggered: 1,
				},
			}
		);
	}
);

interface VaccineAvailabilityNotificationRequestBase extends VaccineFilter {
	user: Types.ObjectId | VaccineUser;
	state: VaccineAvailabilityNotificationRequestState;
	stateHistory: {
		value: VaccineAvailabilityNotificationRequestState;
		at: Date;
	}[];
	createdAt: Date;
	updatedAt: Date;
	lastTriggeredAt?: Date;
	timesTriggered: number;
	lastMessageSentAt?: Date;
	timesSMSSent: number;
	totalTimesTriggered: number;
}

export interface VaccineAvailabilityNotificationRequest
	extends Document,
		VaccineAvailabilityNotificationRequestBase {
	getFilters(this: VaccineAvailabilityNotificationRequest): VaccineFilter;
}

interface VaccineAvailabilityNotificationRequestModel
	extends Model<VaccineAvailabilityNotificationRequest> {
	markFulfilled: (
		this: VaccineAvailabilityNotificationRequestModel,
		ids: (Types.ObjectId | string | any)[],
		smsIds: (Types.ObjectId | string | any)[]
	) => Promise<void>;
}

export default model<
	VaccineAvailabilityNotificationRequest,
	VaccineAvailabilityNotificationRequestModel
>(
	'VaccineAvailabilityNotificationRequest',
	VaccineAvailabilityNotificationRequestSchama
);
