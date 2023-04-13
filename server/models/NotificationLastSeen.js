const mongoose = require('mongoose');
const { notifyUser } = require('../utils/socket');

const Schema = mongoose.Schema;

const NotificationLastSeenSchema = new Schema({
	user: {
		type: Schema.ObjectId,
		required: true,
	},
	product: {
		type: String,
		required: true,
		enum: ['preparation', 'mentorship'],
	},
	timestamp: {
		type: Date,
	},
});

NotificationLastSeenSchema.static('findByProduct', function findByProduct(
	{ product, user },
	callback
) {
	const query = { user };
	this.findOne(query).exec((error, notificationLastRead) => {
		if (error || !notificationLastRead) {
			const newNotificationLastSeen = new this({
				user,
				product,
				createdAt: null,
			});
			newNotificationLastSeen.save((err) => {
				if (err) {
					callback(err);
				} else {
					callback(null, newNotificationLastSeen);
				}
			});
		} else {
			callback(null, notificationLastRead);
		}
	});
});

const onUpdate = (notificationLastSeen) => {
	notifyUser(notificationLastSeen.user.toString(), 'notifications-update', {
		product: notificationLastSeen.product,
	});
};

NotificationLastSeenSchema.post('save', onUpdate);
NotificationLastSeenSchema.post('update', onUpdate);

module.exports = mongoose.model(
	'NotificationLastSeen',
	NotificationLastSeenSchema
);
