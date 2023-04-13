const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const schema = {
	type: [
		{
			account: {
				type: ObjectId,
				ref: 'RazorpayAccount',
				required: true,
			},
			share: {
				type: Number,
				required: true,
				default: 0,
			},
			shareType: {
				type: String,
				enum: ['percentage'],
				default: 'percentage',
			},
		},
	],
	required: true,
	validate: {
		validator(a) {
			return a.length > 0;
		},
	},
};

module.exports = schema;
