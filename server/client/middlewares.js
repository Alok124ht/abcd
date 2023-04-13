const { get } = require('lodash');
const { default: UserModel } = require('../user/user.model');

const Client = require('./client.model').default;

const withClient = async (req, res, next) => {
	const { id: userId, role } = req.payload;
	if (role === 'mentor') {
		const user = await UserModel.findById(userId);
		if (!user) res.status(404).send({ message: 'User not found' });
		else {
			const phase = get(
				user,
				'subscriptions[0].subgroups[0].phases[0].phase',
				null
			);
			if (!phase) res.status(404).send({ message: 'Phase not found' });
			else {
				Client.findOne({ phases: phase })
					.then((client) => {
						if (client) {
							res.locals.client = client;
							next();
						} else res.status(404).send({ message: 'Client not found' });
					})
					.catch((Err) => {
						res.status(500).send({ message: 'Internal Server Error' });
					});
			}
		}
	} else
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
