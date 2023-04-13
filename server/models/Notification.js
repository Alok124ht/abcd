const mongoose = require('mongoose');
const NotificationLastSeen = require('./NotificationLastSeen');
const { notifyUser } = require('../utils/socket');

const ObjectId = mongoose.Schema.Types.ObjectId;

const Action = new mongoose.Schema({
	text: String,
	type: {
		type: String,
		enum: [
			'redirect-internal',
			'redirect-solution-request',
			'redirect-external',
			'open-chat',
			'open-request-detail',
		],
		// add enum as required
		required: true,
	},
	data: {},
	event: {
		type: String,
		enum: ['click'],
		required: true,
	},
	meta: {},
});

const NotificationSchema = new mongoose.Schema(
	{
		user: { type: ObjectId, ref: 'User', required: true },
		isRead: {
			type: Boolean,
			default: false,
		},
		action: Action,
		actions: [Action],
		content: {
			data: String,
			type: {
				type: String,
				enum: ['html', 'text'],
				default: 'html',
			},
		},
		product: {
			type: String,
			enum: ['preparation', 'mentorship', 'p4', 'all'],
			// default value is not set on purpose
			// to reduce the error of sending it to wrong platform
			required: true,
		},
		meta: {},
	},
	{ timestamps: true }
);

NotificationSchema.static(
	'findUnreadByProduct',
	function findUnreadByProduct({ product, user }, callback) {
		NotificationLastSeen.findByProduct(
			{ product, user },
			(error, notificationLastRead) => {
				if (error) {
					callback(error);
				} else {
					const query = { user, product };
					if (notificationLastRead.timestamp) {
						query.createdAt = { $gte: notificationLastRead.timestamp };
					}
					this.find(query)
						.sort('-createdAt')
						.exec((notificationSearchError, notification) => {
							callback(notificationSearchError, notification);
						});
				}
			}
		);
	}
);

NotificationSchema.static(
	'findLatestByProduct',
	function findLatestByProduct({ product, user }, callback) {
		this.find({ product, user })
			.sort('-createdAt')
			.limit(10)
			.exec((error, notification) => {
				if (error) {
					callback(error);
				} else {
					callback(error, notification);
				}
			});
	}
);

NotificationSchema.post('save', (notification) => {
	notifyUser(notification.user.toString(), 'notifications-update', {
		product: notification.product,
	});
});

module.exports = mongoose.model('Notification', NotificationSchema);
