const { ObjectId } = require('mongodb');
const Client = require('./client.model').default;
const User = require('../user/user.model').default;
const Phase = require('../phase/phase.model').default;
const APIError = require('../helpers/APIError');
const RazorpayAccount = require('../models/RazorpayAccount').default;
const { getStrippedEmail } = require('../utils/user/email');
const { permissions: allPermissions } = require('./constants');

function addClient(req, res) {
	const { name } = req.body;

	if (!name) {
		res.json({ success: false, message: 'Name required' });
	} else {
		const client = new Client({
			name,
		});

		client
			.save()
			.then((savedClient) => {
				res.json({ success: true, client: savedClient });
			})
			.catch(() => {
				res.json({ success: false, message: 'Mongo Err' });
			});
	}
}

const updateSupport = (req, res, next) => {
	const { support, client: clientId } = req.body;
	Client.updateOne({ _id: clientId }, { $set: { support } })
		.then((m) => {
			res.send(m);
		})
		.catch(next);
};

function listClients(req, res) {
	Client.find({})
		.populate([
			{ path: 'moderators', select: 'email' },
			{ path: 'razorpayAccounts' },
			{
				path: 'merchants',
				select: 'name razorpayMerchantId',
			},
		])
		.then((clients) => {
			res.json({ success: true, clients });
		})
		.catch(() => {
			res.json({ success: false, message: 'Mongo Err' });
		});
}

const getMyClient = (req, res) => {
	const { client } = res.locals;
	res.send(client);
};

const getPhasesOfClient = (req, res, next) => {
	const { client } = res.locals;
	client
		.populate([
			{
				path: 'phases',
				select: 'name subgroups',
				populate: { path: 'subgroups.subgroup', select: 'name supergroup' },
			},
		])
		.execPopulate((populationError, client) => {
			if (populationError) {
				next(new APIError(populationError, 500));
			} else {
				res.send(client);
			}
		});
};

const getMyRazorpayAccounts = (req, res, next) => {
	const { id: userId, role } = req.payload;
	const query = {};
	const populate = 'razorpayAccounts';
	const select = 'razorpayAccounts';
	if (role === 'super') {
		RazorpayAccount.find().exec((searchError, razorpayAccounts) => {
			if (searchError) {
				next(new APIError(searchError, 500));
			} else {
				res.send({ items: razorpayAccounts });
			}
		});
	} else {
		query.moderators = userId;

		Client.findOne(query)
			.select(select)
			.populate(populate)
			.exec((searchError, client) => {
				if (searchError) {
					next(new APIError(searchError, 500));
				} else if (!client) {
					next(new APIError('Client not found', 404));
				} else {
					res.send({ items: client.razorpayAccounts });
				}
			});
	}
};

const addRazorpayAccountToClient = (req, res, next) => {
	const { clientId, razorpayAccountId } = req.body;
	Client.findById(clientId)
		.then((client) => {
			if (!client) {
				next(new APIError('Client not found', 404, true));
			} else {
				client.razorpayAccounts.push(razorpayAccountId);
				client.save((saveError) => {
					if (saveError) {
						next(new APIError(saveError, 422));
					} else {
						res.send({ client });
					}
				});
			}
		})
		.catch((err) => next(new APIError(err, 500)));
};

const addModerator = (req, res, next) => {
	const { client: clientId, email } = req.body;
	Client.findById(clientId)
		.then((client) => {
			if (!client) {
				next(new APIError('Client not found', 422, true));
			} else {
				User.findOne({ emailIdentifier: getStrippedEmail(email) })
					.then((user) => {
						if (!user) {
							next(new APIError('User not found with this email', 422, true));
						} else if (user.role !== 'moderator') {
							next(new APIError('This user is not a moderator', 422, true));
						} else {
							Client.findOne({ moderators: user._id })
								.then((alreadyHasClient) => {
									if (alreadyHasClient) {
										next(
											new APIError(
												'This moderator already has a client. One moderator can not be assigned to multilpe Clients.',
												422,
												true
											)
										);
									} else {
										client.moderators.push(user._id);
										client.save((saveError) => {
											if (saveError) {
												next(new APIError('Internal server error', 500, true));
											} else {
												res.send({ message: `Added to client ${client.name}` });
											}
										});
									}
								})
								.catch((error) => next(new APIError(error, 500)));
						}
					})
					.catch((error) => next(new APIError(error, 500)));
			}
		})
		.catch((error) => next(new APIError(error, 500)));
};

function updatePhases(req, res) {
	const { client: cId, phases } = req.body;

	Client.findById(cId)
		.then((client) => {
			if (client) {
				const pIds = phases.map((p) => {
					return ObjectId(p);
				});
				Phase.find({ _id: { $in: pIds } }, { _id: -1 })
					.then((phases_) => {
						if (phases_.length === pIds.length) {
							Client.update({ _id: client._id }, { $set: { phases: pIds } }).then(
								() => {
									res.json({ success: true, phases: pIds });
								}
							);
						} else {
							res.json({ success: false, message: 'Mongo Err 1' });
						}
					})
					.catch(() => {
						res.json({ success: false, message: 'Mongo Err 2' });
					});
			} else {
				res.json({ success: false, message: 'Mongo Err 3' });
			}
		})
		.catch(() => {
			res.json({ success: false, message: 'Mongo Err 4' });
		});
}

const getAllPermissions = (req, res) => {
	res.send(allPermissions);
};

const updatePermission = (req, res, next) => {
	const { client: clientId, permissions: permissionIds } = req.body;
	Client.findById(clientId).then((client) => {
		if (client) {
			const itemsToRemove = client.permissions
				.filter((permission) => permissionIds.indexOf(permission.id) === -1)
				.map((p) => p._id);
			client.permissions.pull(...itemsToRemove);
			client.permissions.push(...permissionIds.map((id) => ({ id })));
			client.save((saveError) => {
				if (saveError) {
					next(new APIError(saveError.message, 422, true));
				} else {
					res.send({ client });
				}
			});
		} else {
			next(new APIError('Client not found', 404, true));
		}
	});
};

module.exports = {
	addClient,
	addModerator,
	addRazorpayAccountToClient,
	getAllPermissions,
	getMyClient,
	getMyRazorpayAccounts,
	getPhasesOfClient,
	listClients,
	updatePermission,
	updatePhases,
	updateSupport,
};
