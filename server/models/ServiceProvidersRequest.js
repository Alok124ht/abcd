const mongoose = require('mongoose');
const ServiceProvidersShareSchema = require('./ServiceProvidersShareSchema');

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

const ServiceProvidersRequestSchema = new Schema(
	{
		service: {
			type: ObjectId,
			ref: 'Service',
		},
		createdBy: {
			type: ObjectId,
			ref: 'User',
		},
		action: {
			type: String,
			enum: ['approve', 'reject'],
		},
		actionBy: {
			type: ObjectId,
			ref: 'User',
		},
		statusRequested: {
			type: String,
			enum: ['active'],
		},
		items: ServiceProvidersShareSchema,
	},
	{ timestamps: true }
);

module.exports = mongoose.model(
	'ServiceProvidersRequest',
	ServiceProvidersRequestSchema
);
