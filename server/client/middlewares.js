const Client = require('./client.model').default;

const withClient = (req, res, next) => {
	const { id: userId } = req.payload;
	Client.findOne({ moderators: userId }).exec((error, client) => {
		if (error) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!client) {
			res.status(404).send({ message: 'Client not found' });
		} else {
			// eslint-disable-next-line no-param-reassign
			res.locals.client = client;
			next();
		}
	});
};

const withClientOnlyIfModerator = (req, res, next) => {
	const { id: userId, role } = req.payload;
	if (role === 'admin' || role === 'super') {
		next();
	} else {
		Client.findOne({ moderators: userId }).exec((error, client) => {
			if (error) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else if (!client) {
				res.status(404).send({ message: 'Client not found' });
			} else {
				// eslint-disable-next-line no-param-reassign
				res.locals.client = client;
				next();
			}
		});
	}
};

module.exports = { withClient, withClientOnlyIfModerator };
