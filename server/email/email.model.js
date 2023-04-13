const mongoose = require('mongoose');

const EmailSchema = new mongoose.Schema({
	//save ip address/ mac address to protect against hacks?
	subject: {
		type: String,
	},
	data: {
		type: String,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	sent: {
		type: Boolean,
		default: false,
	},
});

EmailSchema.statics = {};

module.exports = mongoose.model('Email', EmailSchema);
