import { Document, Schema, model } from 'mongoose';
import moment from 'moment';
import { some } from 'lodash';
import Discount from './Discount';
import { IOffer, OfferModel } from '../types/Offer';

const { ObjectId } = Schema.Types;

const OfferSchema = new Schema(
	{
		startTime: {
			type: Date,
			required: true,
		},
		endTime: {
			type: Date,
			required: true,
		},
		items: [
			{
				value: {
					type: Schema.Types.ObjectId,
					refPath: 'items.itemModel',
					required: true,
				},
				itemModel: {
					type: String,
					required: true,
					enum: ['ServicePlan'],
					default: 'ServicePlan',
				},
			},
		],
		validations: [
			{
				type: String,
				value: Schema.Types.Mixed,
			},
		],
		usageLimit: {
			type: Number,
			default: -1,
		},
		timesUsed: {
			type: Number,
			default: 0,
			required: true,
			min: [0, 'Can not be used less than once'],
		},
		discount: Discount,
		createdBy: {
			type: ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

OfferSchema.method('isValid', function isValid(item: string | Document) {
	return new Promise((resolve, reject) => {
		const currentMoment = moment();
		if (
			currentMoment.isBefore(this.startTime) ||
			currentMoment.isAfter(this.endTime)
		) {
			reject(new Error('Either this offer has expired or invalid'));
		} else if (this.usageLimit !== -1 && this.timesUsed > this.usageLimit) {
			reject(
				new Error('The offer has expired or has reached its maximum usage limit')
			);
		} else if (
			!some(this.items, (i) => {
				if (typeof item === 'string') {
					return i.value.equals(item);
				}
				return item._id.equals(i.value);
			})
		) {
			reject(new Error('This offer is not valid for this product'));
		} else {
			resolve(undefined);
		}
	});
});

OfferSchema.static(
	'findActiveByServicePlans',
	function findActive(servicePlanIds) {
		const now = Date.now();
		return new Promise((resolve, reject) => {
			this.find({
				$and: [
					{
						items: {
							$elemMatch: { value: { $in: servicePlanIds }, itemModel: 'ServicePlan' },
						},
					},
					{
						startTime: { $lte: now },
						endTime: { $gte: now },
					},
				],
			}).exec((searchError, offers) => {
				if (searchError) {
					reject(searchError);
				} else {
					resolve(offers);
				}
			});
		});
	}
);

export default model<IOffer, OfferModel>('Offer', OfferSchema);
