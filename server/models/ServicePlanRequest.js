const mongoose = require('mongoose');
const UserServicePlan = require('./UserServicePlan');

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

const statesEnum = ['created', 'pending', 'paid'];

const ServicePlanRequestSchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		servicePlan: {
			type: ObjectId,
			ref: 'ServicePlan',
			required: true,
		},
		state: {
			type: String,
			enum: statesEnum,
			required: true,
		},
		lifeCycle: [
			{
				state: { type: String, enum: statesEnum, required: true },
				createdAt: { type: Date, default: Date.now },
			},
		],
		order: {
			/**
			 * assigned when order is successful
			 */
			type: ObjectId,
			ref: 'Order',
		},
		createdBy: {
			// when admin creates
			type: ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

ServicePlanRequestSchema.method('markPaid', function markPaid(order) {
	this.state = 'paid';
	this.lifeCycle.push({ state: 'paid' });
	this.order = order;
	return new Promise((resolve, reject) => {
		this.save((saveError) => {
			if (saveError) {
				reject(saveError);
			} else {
				this.populate(
					{ path: 'servicePlan', populate: { path: 'services' } },
					(populationError, servicePlanRequest) => {
						if (populationError) {
							reject(new Error('Unable to populate servicePlan'));
						} else {
							UserServicePlan.createFromServicePlanRequest(
								servicePlanRequest,
								this.user
							)
								.then(resolve)
								.catch(reject);
						}
					}
				);
			}
		});
	});
});

ServicePlanRequestSchema.method(
	'getTransfers',
	function getTransfers(amount, currency) {
		return new Promise((resolve, reject) => {
			const handlePopulated = (servicePlanRequest) => {
				servicePlanRequest.servicePlan
					.getTransfers(amount, currency)
					.then((transfers) => {
						resolve(transfers);
					})
					.catch((error) => {
						reject(error);
					});
			};
			if (this.populated('servicePlan')) {
				handlePopulated(this);
			} else {
				this.populate('servicePlan', (error, servicePlan) => {
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

module.exports = mongoose.model('ServicePlanRequest', ServicePlanRequestSchema);
