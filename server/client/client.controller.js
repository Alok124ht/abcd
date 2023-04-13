const { reverse, get, forEach } = require('lodash');
const { ObjectId } = require('mongodb');
const { default: PhaseMentorModel } = require('../phase/PhaseMentor');
const { CbtTokenModel } = require('../cbt/models/CbtToken.model');
const {
	ClientTokenModel,
} = require('../client-addons/models/clientToken.model');
const Client = require('./client.model').default;
const User = require('../user/user.model').default;
const Phase = require('../phase/phase.model').default;
const APIError = require('../helpers/APIError');
const { default: UserModel } = require('../user/user.model');
const RazorpayAccount = require('../models/RazorpayAccount').default;
const { getStrippedEmail } = require('../utils/user/email');
const { permissions: allPermissions } = require('./constants');

function addClient(req, res) {
	const { name, portal, clientType } = req.body;

	if (!name || !portal || !clientType) {
		res.json({ success: false, message: 'Name, Type & portal required' });
	} else {
		const client = new Client({
			name,
			portal,
			clientType,
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
		.sort({ archive: -1 })
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
	const { role, id: payloadId } = req.payload;
	const { client } = res.locals;
	if (role === 'moderator')
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
	else {
		const phases = [];
		UserModel.findOne({ id: payloadId })
			.then((user) => {
				phases.push(
					get(user, 'subscriptions[0].subgroups[0].phases[0].phase', null)
				);
				PhaseMentorModel.find({ user: payloadId })
					.then((mentors) => {
						forEach(mentors, (men) => {
							phases.push(men.phase);
						});
						Phase.find({ _id: { $in: phases } })
							.select('name subgroups')
							.populate({ path: 'subgroups.subgroup', select: 'name supergroup' })
							.then((phases) => {
								client.phases = phases;
								res.send(client);
							})
							.catch((Err) => {
								next(new APIError(Err, 500));
							});
					})
					.catch((Err) => {
						next(new APIError(Err, 500));
					});
			})
			.catch((err) => {
				next(new APIError(err, 500));
			});
	}
};

const getPhasesByUserId = (req, res) => {
	const { id: userId } = req.payload;
	Client.findOne({
		moderators: userId,
	})
		.populate('phases', 'name _id')
		.then((client) => {
			if (client) {
				res.send({ success: true, phases: client.phases });
			} else {
				res.send({ success: false, msg: 'Client not found' });
			}
		})
		.catch((err) => {
			res.send({ success: false, msg: 'Error while fetching the details' });
		});
};

function listClientNames(req, res) {
	Client.find({
		portal: 'lms',
		archive: { $ne: true },
	})
		.select('name logo')
		.then((clients) => {
			res.json({ success: true, clients });
		})
		.catch(() => {
			res.json({ success: false, message: 'Mongo Err' });
		});
}

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

const addModerator = async (req, res, next) => {
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
						} else if (user.role !== 'moderator' && client.portal === 'lms') {
							next(new APIError('This user is not a moderator', 422, true));
						} else {
							Client.findOne({ moderators: user._id })
								.then(async (alreadyHasClient) => {
									if (alreadyHasClient) {
										next(
											new APIError(
												'This moderator already has a client. One moderator can not be assigned to multilpe Clients.',
												422,
												true
											)
										);
									} else {
										if (client.portal === 'erp') {
											const userChanged = await UserModel.updateOne(
												{
													email,
												},
												{
													$set: {
														role: 'moderator',
													},
												}
											);
											if (!userChanged.nModified) {
												next(
													new APIError(
														'Error while Adding as moderator please try again.',
														422,
														true
													)
												);
											}
										}
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

const addClientLogo = (req, res) => {
	const { id } = req.params;
	const { logo } = req.body;

	if (!logo) {
		res.send({ success: false, msg: "Request don't have sufficient data" });
		return;
	}

	Client.updateOne(
		{ _id: ObjectId(id) },
		{
			$set: {
				logo: logo,
			},
		}
	)
		.then((res) => {
			res.send({ success: true });
		})
		.catch((err) => {
			res.send({ success: false, msg: 'Unable to update logo' });
		});
};

const setClientStatus = (req, res) => {
	const { id } = req.params;
	const { archive } = req.query;

	Client.updateOne(
		{
			_id: ObjectId(id),
		},
		{
			$set: {
				archive,
			},
		}
	)
		.then((updated) => res.send({ success: true, updated }))
		.catch((err) => res.send({ success: false }));
};

const getAllMentorAndModeratorsIds = async (moderatorId) => {
	const users = [];
	const client = await Client.findOne({ moderators: moderatorId }).select(
		'phases'
	);
	const dbUser = await User.find({
		role: { $in: ['moderator', 'mentor'] },
		'subscriptions.subgroups.phases.phase': { $in: client.phases },
	});
	dbUser.forEach((user) => {
		users.push(user._id);
	});
	return users;
};

const getClientProfile = (req, res) => {
	const { id: clientId } = req.query;
	if (!clientId) {
		res.send({ success: false, msg: 'Id not found!' });
		return;
	}
	Client.findById(clientId)
		.populate([
			{ path: 'phases', select: 'name endDate' },
			{ path: 'moderators', select: 'name email' },
			{
				path: 'merchants',
				select: 'apiKeyId apiKeySecret razorpayMerchantId name',
			},
		])
		.then(async (client) => {
			client.phases = reverse(client.phases);
			const token = await ClientTokenModel.find({
				client: clientId,
				active: true,
			});
			const cbtTokens = await CbtTokenModel.find({
				client: clientId,
				active: true,
			});
			res.send({ success: true, client, token, cbtTokens });
		})
		.catch(() =>
			res.send({ success: false, msg: 'Unable to get client details!' })
		);
};

module.exports = {
	addClient,
	addModerator,
	addRazorpayAccountToClient,
	getAllPermissions,
	getMyClient,
	getMyRazorpayAccounts,
	getPhasesOfClient,
	listClientNames,
	listClients,
	updatePermission,
	updatePhases,
	updateSupport,
	addClientLogo,
	setClientStatus,
	getAllMentorAndModeratorsIds,
	getPhasesByUserId,
	getClientProfile,
};
