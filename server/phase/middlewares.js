const { size } = require('lodash');
const Client = require('../client/client.model').default;
const Phase = require('./phase.model').default;
const APIError = require('../helpers/APIError');
const User = require('../user/user.model').default;
const { isAtLeast } = require('../utils/user/role');

const withPhases = (req, res, next) => {
	const { id: userId, role } = req.payload;
	Client.findOne({ moderators: userId }, { phases: 1 })
		.populate([{ path: 'phases' }])
		.exec((error, client) => {
			if (error) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else if (!client) {
				if (role === 'super' || role === 'admin') {
					Phase.find({}).exec((searchError, phases) => {
						if (error) {
							res.status(404).send({ message: 'Not found' });
						} else {
							// eslint-disable-next-line no-param-reassign
							res.locals.phases = phases.map((phase) => phase._id.toString());
							next();
						}
					});
				} else if (isAtLeast('mentor', role)) {
					res.locals.phases = [];
					next();
				} else {
					res.status(404).send({ message: 'Not found' });
				}
			} else {
				// eslint-disable-next-line no-param-reassign
				res.locals.phases = client.phases.map((phase) => phase._id.toString());
				next();
			}
		});
};

/**
 * Search user
 */
const createWithUserSearch = (select) => (req, res, next) => {
	const { username, user: userId } = req.body;
	const query = {};
	if (userId) {
		query._id = userId;
	} else {
		query.username = username;
	}

	User.find(query, select)
		.then((users) => {
			if (size(users) === 0) {
				next(new APIError('User not found', 404));
			} else if (size(users) > 1) {
				next(new APIError('Multiple user for searched criteria', 422));
			} else {
				// eslint-disable-next-line no-param-reassign
				res.locals.user = users[0];
				next();
			}
		})
		.catch(() => next(new APIError('Internal Server Error', 500)));
};

module.exports = { withPhases, createWithUserSearch };
