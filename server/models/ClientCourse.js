const mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId;

const ClientCourseSchema = new mongoose.Schema(
	{
		servicePlans: [
			{
				type: ObjectId,
				ref: 'ServicePlan',
			},
		],
		clientCourseId: {
			type: String,
			required: true,
		},
		label: String,
		client: {
			type: ObjectId,
			ref: 'Client',
			required: true,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model('ClientCourse', ClientCourseSchema);
