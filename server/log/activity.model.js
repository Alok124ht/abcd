const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const ActivitySchema = new mongoose.Schema(
	{
		// save ip address or mac address to protect against hacks?
		user: {
			type: ObjectId,
			ref: 'User',
		},
		count: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
	}
);

ActivitySchema.statics = {
	increment(id) {
		// write a function for incrementMany
		this.update({ user: id }, { $inc: { count: 1 } }).then((m) => {
			if (m.n === 0) {
				const activity = new this({ user: id, count: 1 });
				activity.save();
			}
		});
	},
};

module.exports = mongoose.model('Activity', ActivitySchema);
