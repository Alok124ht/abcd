const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const WrapperDataSchema = new mongoose.Schema({
	wrapperAnalysis: {
		type: ObjectId,
		ref: 'WrapperAnalysis',
		required: true,
		index: true,
	},
	data: {
		type: Object,
		default: {},
	},
	used: {
		type: Boolean,
		default: false,
		iindex: true,
	},
});

module.exports = mongoose.model('WrapperData', WrapperDataSchema);
