const mongoose = require('mongoose');
const { types } = require('../dashboardCard/config');

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const Mixed = Schema.Types.Mixed;

const DashboardCardSchema = new mongoose.Schema(
	{
		createdBy: {
			type: ObjectId,
			ref: 'User',
		},
		phase: {
			type: ObjectId,
			ref: 'Phase',
		},
		phases: [{ type: ObjectId, ref: 'Phase', required: true }],
		image: {
			type: String,
		},
		url: {
			type: String,
		},
		type: {
			type: String,
			enum: types,
			default: 'image',
			required: true,
		},
		tags: [
			{
				key: {
					type: String,
					required: true,
				},
				value: {
					type: Mixed,
				},
			},
		],
		isPublished: {
			type: Boolean,
			default: false,
		},
		order: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model('DashboardCard', DashboardCardSchema);
