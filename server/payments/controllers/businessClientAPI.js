const _ = require('lodash');
const ClientCourse = require('../../models/ClientCourse');
const Client = require('../../client/client.model').default;
const UserServicePlan = require('../../models/UserServicePlan');

const addUserServicePlan = (req, res) => {
	const { id: clientCourseId, user: userId } = req.body;
	const { client } = req.locals;
	ClientCourse.findOne({ clientCourseId, client: client._id })
		.populate({
			path: 'servicePlans',
			populate: {
				path: 'services',
			},
		})
		.exec((error, clientCourse) => {
			if (error) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else if (!clientCourse) {
				res.status(422).send({ message: 'Invalid course ID' });
			} else {
				clientCourse.servicePlans.forEach((servicePlan) => {
					servicePlan.services.forEach((service) => {
						const userServicePlan = new UserServicePlan({
							phase: service.phase,
							serviceMachineName: service.machineName,
							servicePlan: servicePlan._id,
							user: userId,
						});
						userServicePlan.save((saveError) => {
							if (saveError) {
								res.status(500).send({ message: '', error: saveError });
							} else {
								res.send({ userServicePlan });
							}
						});
					});
				});
			}
		});
};

const validateClientToken = (req, res, next) => {
	const { accessToken } = req.body || req.query;
	Client.findOne({ accessToken }).exec((clientSearchError, client) => {
		if (clientSearchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!client) {
			res.status(422).send({ message: 'Invalid access token' });
		} else {
			// eslint-disable-next-line no-param-reassign
			res.locals.client = client;
			next();
		}
	});
};

const canClientModifyThisUser = (client, user) => {
	if (_.intersection(user.subscriptions, client.phases).length > 1) {
		return true;
	}
	return false;
};

const validateCourseParams = (label, servicePlans, clientCourseId) =>
	new Promise((resolve, reject) => {
		if (typeof label !== 'string' || label.trim().length === 0) {
			return reject({
				message: 'Label can not be empty',
				errors: { label: 'This field can not be empty' },
			});
		}
		if (!_.isArray(servicePlans) || _.isEmpty(servicePlans)) {
			return reject({
				message: 'Must have at least one Service Plan',
				errors: {
					servicePlans: 'Must have at least one Service Plan',
				},
			});
		}
		if (
			_.isEmpty(clientCourseId) ||
			typeof clientCourseId !== 'string' ||
			clientCourseId.trim().length === 0
		) {
			return reject({
				message: 'clientCourseId must be filled',
				fields: { clientCourseId: 'This field can not be empty' },
			});
		}
		return resolve();
	});

const addCourse = (req, res) => {
	const { client } = res.locals;
	const { label, servicePlans, clientCourseId } = req.body;
	const clientCourse = new ClientCourse({
		label,
		servicePlans,
		clientCourseId,
		client: client._id,
	});
	validateCourseParams(label, servicePlans, clientCourseId)
		.then(() => {
			clientCourse.save((saveError) => {
				if (saveError) {
					res.status(422).send({ message: 'Unable to save', error: saveError });
				} else {
					res.send({ clientCourse });
				}
			});
		})
		.catch((e) => {
			res.status(422).send(e);
		});
};

module.exports = {
	addUserServicePlan,
	validateClientToken,
	addCourse,
};
