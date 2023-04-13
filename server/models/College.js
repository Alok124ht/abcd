const mongoose = require('mongoose');

const CollegeSchema = new mongoose.Schema({
	college: {
		type: String,
		required: true,
	},
	user: {
		type: String,
		required: true,
	},
});

module.exports = mongoose.model('College', CollegeSchema);
