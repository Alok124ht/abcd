import mongoose, { model } from 'mongoose';
import mongooseDelete from 'mongoose-delete';
import { size } from 'lodash';
import Offer from './Offer';
import { IServicePlan, ServicePlanModel } from '../types/ServicePlan';
import { IOffer } from '../types/Offer';

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const ServicePlanSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		description: {
			type: String,
			required: true,
		},
		services: {
			type: [
				{
					type: ObjectId,
					ref: 'Service',
					required: true,
				},
			],
			validate: {
				validator: (val: any[]) => size(val) !== 0,
				message: 'At least one service must be selected',
			},
		},
		visibleIn: [
			{
				type: { type: String, enum: ['Phase'] },
				value: {
					type: ObjectId,
					ref: 'Phase',
				},
			},
		],
		basePrice: {
			/**
			 * In paise (100 paise = 1 rupee)
			 */
			type: Number,
			required: true,
			min: [0, 'basePrice should be a non-negative number'],
		},
		currency: {
			/**
			 * Name used to identify a service as human readable service name can change frequently
			 */
			type: String,
			enum: ['INR'],
			default: 'INR',
			required: true,
		},
		duration: {
			/**
			 * Number of milliseconds
			 * -1 means unlimited
			 */
			type: Number,
			min: [-1, 'Duration can either be a non negative number or -1'],
			required: true,
		},
		thumbNailUrl: { type: String },
		createdBy: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		updatedBy: {
			type: ObjectId,
			ref: 'User',
		},
		merchant: {
			type: ObjectId,
			ref: 'Merchant',
		},
		disableTransfers: {
			type: Boolean,
			default: false,
		},
		tags: [
			{
				key: String,
				value: String,
			},
		],
	},
	{ timestamps: true }
);

ServicePlanSchema.method(
	'getTransfers',
	function getTransfers(amount: number, currency: 'INR') {
		if (this.disableTransfers) {
			return new Promise((resolve) => {
				resolve([]);
			});
		}
		return new Promise((resolve, reject) => {
			const handlePopulated = (servicePlan) => {
				if (!(servicePlan.services.length > 0)) {
					reject();
					return;
				}
				const amountPerService = amount / servicePlan.services.length;

				// assuming equal amount distribution to all the services
				Promise.all(
					servicePlan.services.map(
						(service) =>
							new Promise((_resolve, _reject) => {
								if (service.getTransfers) {
									service
										.getTransfers(amountPerService, currency)
										.then((transfers) => {
											_resolve(transfers);
										})
										.catch((_e) => _reject(_e));
								} else {
									resolve([]);
								}
							})
					)
				)
					.then((listOfTransfers) => {
						let transfers = [];
						listOfTransfers.forEach((transfersItem) => {
							transfers = [...transfers, ...transfersItem];
						});
						resolve(transfers);
					})
					.catch((error) => {
						reject(error);
					});
			};
			if (this.populated('services')) {
				handlePopulated(this);
			} else {
				this.populate('services', (error, servicePlan) => {
					if (error) {
						reject(error);
					} else {
						handlePopulated(servicePlan);
					}
				});
			}
		});
	}
);

ServicePlanSchema.method('getOffers', function getServicePlanOffers(): Promise<
	IOffer[]
> {
	return new Promise((resolve, reject) => {
		Offer.find({
			items: { $elemMatch: { value: this._id, itemModel: 'ServicePlan' } },
		}).exec((searchError, offers) => {
			if (searchError) {
				reject(searchError);
			} else {
				this.offers = offers;
				resolve(offers);
			}
		});
	});
});

ServicePlanSchema.plugin(mongooseDelete, {
	deletedAt: true,
	deletedBy: true,
	overrideMethods: 'all',
});

export default model<IServicePlan, ServicePlanModel>(
	'ServicePlan',
	ServicePlanSchema
);
