const Notification = require('../models/Notification');
const NotificationLastSeen = require('../models/NotificationLastSeen');

const getUnread = (req, res) => {
	const { id: userId } = req.payload;
	const { product = 'mentorship' } = req.query;
	Notification.findUnreadByProduct(
		{
			user: userId,
			product,
		},
		(err, notifications) => {
			if (err) {
				res.status(500).send({
					message: 'Internal server error',
				});
			} else {
				res.send({ items: notifications });
			}
		}
	);
};

const getLatest = (req, res) => {
	const { id: userId } = req.payload;
	const { product = 'mentorship' } = req.query;
	Notification.findLatestByProduct(
		{
			user: userId,
			product,
		},
		(err, notifications) => {
			if (err) {
				res.status(500).send({
					message: 'Internal server error',
				});
			} else {
				res.send({ items: notifications });
			}
		}
	);
};

const updateLastSeen = (req, res) => {
	const { id: userId } = req.payload;
	const { product } = req.body;
	res.send({});
	NotificationLastSeen.findByProduct(
		{ product, user: userId },
		(error, notificationLastRead) => {
			notificationLastRead.set('timestamp', Date.now());
			notificationLastRead.save();
		}
	);
};

module.exports = { getUnread, getLatest, updateLastSeen };
