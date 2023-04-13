const mongoose = require('mongoose');

const RegistrationSchema = new mongoose.Schema(
	{
		data: {
			type: Object,
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

module.exports = mongoose.model('Registration', RegistrationSchema);
