const mongoose = require('mongoose');
const mongooseHidden = require('mongoose-hidden')({ defaultHidden: {} });
const ServiceProviders = require('./ServiceProviders');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const ServiceSchema = new Schema(
	{
		phase: {
			type: ObjectId,
			ref: 'Phase',
			required: true,
		},
		name: {
			/**
			 * Human readable service name
			 */
			type: String,
			required: true,
		},
		description: {
			type: String,
			required: true,
		},
		machineName: {
			/**
			 * Name used to identify a service as human readable service name can change frequently
			 */
			type: String,
			required: true,
		},
		accessKey: {
			type: String,
			hide: true,
		},
		createdBy: {
			type: ObjectId,
			ref: 'User',
		},
		updatedBy: {
			type: ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

ServiceSchema.method(
	'getTransfers',
	function getTransfers(amount = 0, currency = 'INR') {
		return new Promise((resolve, reject) => {
			ServiceProviders.findOne({ service: this._id, status: 'active' })
				.populate('items.account')
				.exec((searchError, serviceProviders) => {
					if (searchError) {
						reject(searchError);
					} else if (!serviceProviders) {
						resolve([]);
					} else {
						const transfers = [];
						serviceProviders.items.forEach((item) => {
							if (item.shareType === 'percentage') {
								if (item.share > 0 && item.share <= 100) {
									const sharedAmount = (amount * item.share) / 100;
									if (sharedAmount > 0) {
										transfers.push({
											account: item.account.razorpayAccountId,
											currency,
											amount: sharedAmount,
										});
									}
								}
							}
						});
						resolve(transfers);
					}
				});
		});
	}
);

ServiceSchema.plugin(mongooseHidden);

module.exports = mongoose.model('Service', ServiceSchema);
