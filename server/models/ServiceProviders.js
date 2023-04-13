const mongoose = require('mongoose');
const ServiceProvidersShareSchema = require('./ServiceProvidersShareSchema');

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

const ServiceProvidersSchema = new Schema(
	{
		items: ServiceProvidersShareSchema,
		service: {
			type: ObjectId,
			ref: 'Service',
			required: true,
		},
		// status of the service provider
		status: {
			type: String,
			enum: ['requested', 'active', 'disabled'],
		},
		requests: [
			{
				type: ObjectId,
				ref: ' ',
			},
		],
		createdBy: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model('ServiceProviders', ServiceProvidersSchema);
