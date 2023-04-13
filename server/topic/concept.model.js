const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const ConceptSchema = new mongoose.Schema(
	{
		// rename this to group
		name: {
			type: String,
			required: true,
		},
		topic: {
			type: String,
			required: true,
		},
		sub_topic: {
			type: String,
			required: true,
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

ConceptSchema.statics = {};

module.exports = mongoose.model('Concept', ConceptSchema);
