/* eslint-disable indent */
const mongoose = require('mongoose');

const DiscountSchema = new mongoose.Schema({
	value: {
		type: Number,
		required: true,
	},
	unit: {
		type: String,
		enum: ['percentage', 'absolute'],
	},
	maximumAmount: {
		type: Number,
		min: [-1, 'Maximum amount should be positive or -1'],
		// -1 represents no limit
	},
});

DiscountSchema.methods.calculate = function calculate(price) {
	if (this.unit === 'percentage') {
		const discount = (this.value * price) / 100;
		if (this.maximumAmount === -1) {
			return discount;
		}
		return Math.floor(Math.min(this.maximumAmount, discount));
	}
	if (this.unit === 'absolute') {
		return Math.min(this.value, price);
	}

	return 0;
};

module.exports = DiscountSchema;
