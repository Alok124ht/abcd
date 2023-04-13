const { includes, map } = require('lodash');
const Service = require('../../../models/Service');
const ServicePlan = require('../../../models/ServicePlan').default;
const Client = require('../../../client/client.model').default;
const Phase = require('../../../phase/phase.model').default;
const APIError = require('../../../helpers/APIError');

const withPhases = (req, res, next) => {
	const { id: userId, role } = req.payload;
	Client.findOne({ moderators: userId }, { phases: 1 })
		.populate([{ path: 'phases' }])
		.exec((error, client) => {
			if (error) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else if (!client) {
				if (role === 'super') {
					Phase.find({}).exec((searchError, phases) => {
						if (error) {
							res.status(404).send({ message: 'Not found' });
						} else {
							// eslint-disable-next-line no-param-reassign
							res.locals.phases = phases.map((phase) => phase._id.toString());
							next();
						}
					});
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

const getServiceList = (req, res) => {
	const { phases } = res.locals;
	Service.find({ phase: { $in: phases } })
		.populate({ path: 'phase', selcet: 'name' })
		.exec((searchError, services) => {
			if (searchError) {
				res
					.status(500)
					.send({ message: 'Database error', errorMessage: searchError.message });
			} else {
				res.send({
					services: map(services, (s) => ({
						...s.toObject(),
						accessKey: s.accessKey,
					})),
				});
			}
		});
};

const getServicePlanList = (req, res) => {
	const { phases } = res.locals;
	const { onlyDeleted } = req.query;
	const findFunction = onlyDeleted === '1' ? 'findDeleted' : 'find';
	ServicePlan[findFunction]({})
		.populate({ path: 'services', populate: { path: 'phase', select: 'name' } })
		.sort({ createdAt: -1 })
		.exec((searchError, servicePlans) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else {
				res.send({
					servicePlans: servicePlans.filter((servicePlan) =>
						servicePlan.services.some(
							(service) => phases.indexOf(service.phase._id.toString()) > -1
						)
					),
				});
			}
		});
};

const createService = (req, res) => {
	const { phases } = res.locals;
	const { id: userId } = req.payload;
	const { description, phase, name, machineName } = req.body;
	if (includes(phases, phase)) {
		const service = new Service({
			description,
			phase,
			name,
			machineName,
			createdBy: userId,
		});
		service.save((saveError, savedService) => {
			if (saveError) {
				res.status(500).send({
					message: 'Error occurred while saving',
					errorMessage: saveError.message,
				});
			} else {
				res.send({ savedService });
			}
		});
	} else {
		res.status(422).send({ message: 'You are not allowed to manage this phase' });
	}
};

const updateService = (req, res) => {
	const { phases } = res.locals;
	const { id: userId } = req.payload;
	const { _id, description, phase, name, machineName } = req.body;
	if (includes(phases, phase)) {
		Service.findOne({ _id, phase: { $in: phases } }).exec(
			(searchError, service) => {
				if (searchError) {
					res.status(500).send({ message: 'Internal Server Error' });
				} else if (!service) {
					res.status(403).send({ message: 'Not authorized to edit this service' });
				} else {
					service.set('description', description);
					service.set('phase', phase);
					service.set('name', name);
					service.set('machineName', machineName);
					service.set('updatedBy', userId);
					if (!service.createdBy) {
						service.set('createdBy', userId);
					}
					service.save((saveError, savedService) => {
						if (saveError) {
							res.status(500).send({
								message: 'Error occurred while saving',
								errorMessage: saveError.message,
							});
						} else {
							res.send({ savedService });
						}
					});
				}
			}
		);
		// const service = new Service({ description, phase, name, machineName });
	} else {
		res.status(422).send({ message: 'You are not allowed to manage this phase' });
	}
};

const validateServiceAccessFn = (services, phases) =>
	new Promise((resolve, reject) => {
		Service.countDocuments(
			{ _id: { $in: services }, phase: { $nin: phases } },
			(countError, count) => {
				if (countError) {
					reject({ message: 'Internal Server Error' });
				} else if (count) {
					reject({ message: 'You do not have access to edit this service' });
				} else {
					resolve();
				}
			}
		);
	});

const validateServiceAccess = (req, res, next) => {
	const { services } = req.body;
	const { phases } = res.locals;
	Service.countDocuments(
		{ _id: { $in: services }, phase: { $nin: phases } },
		(countError, count) => {
			if (countError) {
				res
					.status(500)
					.send({ message: 'Internal Server Error', error: countError });
			} else if (count) {
				res.status(422).send({
					message:
						'You do not have permission to add one or more services from the list you have selected',
				});
			} else {
				next();
			}
		}
	);
};

const createServicePlan = (req, res) => {
	const { id: userId } = req.payload;
	const {
		services,
		basePrice,
		description,
		duration,
		merchant,
		name,
		tags,
		thumbNailUrl,
		visibleIn,
	} = req.body;

	const servicePlan = new ServicePlan({
		basePrice,
		description,
		duration,
		merchant,
		name,
		services,
		createdBy: userId,
		tags,
		thumbNailUrl,
		visibleIn,
	});
	servicePlan.save((saveError, savedServicePlan) => {
		if (saveError) {
			res.status(500).send({
				message: 'Error occurred while saving',
				errorMessage: saveError.message,
				services,
			});
		} else {
			res.send({ servicePlan: savedServicePlan });
		}
	});
};

const updateServicePlan = (req, res) => {
	const {
		_id,
		services,
		basePrice,
		description,
		duration,
		merchant,
		name,
		tags,
		thumbNailUrl,
		visibleIn,
	} = req.body;
	const { phases } = res.locals;
	const { id: userId } = req.payload;

	ServicePlan.findOne({ _id }).exec((searchError, servicePlan) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!servicePlan) {
			res.status(404).send({ message: 'Service Plan not found' });
		} else {
			validateServiceAccessFn(servicePlan.services, phases).then(() => {
				servicePlan.set('basePrice', basePrice);
				servicePlan.set('description', description);
				servicePlan.set('duration', duration);
				servicePlan.set('name', name);
				servicePlan.set('services', services);
				servicePlan.set('merchant', merchant);
				servicePlan.set('tags', tags);
				servicePlan.set('visibleIn', visibleIn);
				if (!servicePlan.createdBy) {
					servicePlan.set('createdBy', userId);
				}
				if (typeof thumbNailUrl !== 'undefined') {
					servicePlan.set('thumbNailUrl', thumbNailUrl);
				}
				servicePlan.set('updatedBy', userId);
				servicePlan.save((saveError, savedServicePlan) => {
					if (saveError) {
						res.status(500).send({
							message: 'Error occurred while saving',
							errorMessage: saveError.message,
							services,
						});
					} else {
						res.send({ servicePlan: savedServicePlan });
					}
				});
			});
		}
	});
};

const deleteServicePlan = (req, res) => {
	const { id } = req.payload;
	const { _id } = req.body;
	const { phases } = res.locals;
	ServicePlan.findOne({ _id }).exec((searchError, servicePlan) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!servicePlan) {
			res.status(404).send({ message: 'Service Plan not found' });
		} else {
			validateServiceAccessFn(servicePlan.services, phases)
				.then(() => {
					servicePlan.delete(id, (deletionError) => {
						if (deletionError) {
							res.status(422).send({
								message: 'Error occurred while restoring',
								error: deletionError,
							});
						} else {
							res.send({ servicePlan });
						}
					});
				})
				.catch((error) => {
					res.status(422).send({ message: error.message });
				});
		}
	});
};

const restoreServicePlan = (req, res) => {
	const { _id } = req.body;
	const { phases } = res.locals;
	ServicePlan.findOneDeleted({ _id }).exec((searchError, servicePlan) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!servicePlan) {
			res.status(404).send({ message: 'Service Plan not found' });
		} else {
			validateServiceAccessFn(servicePlan.services, phases)
				.then(() => {
					servicePlan.restore((restoreError) => {
						if (restoreError) {
							res.status(422).send({
								message: 'Error occurred while restoring',
								error: restoreError,
							});
						} else {
							res.send({ servicePlan });
						}
					});
				})
				.catch((error) => {
					res.status(422).send({ message: error.message });
				});
		}
	});
};

const generateAccessKey = (length) => {
	let key = '';
	const seed = 'azqwsxcderfvtgbnhyujmkiolp1357902468QWPOERIUTYALSKDJFHGZMXNCB-_';

	for (let i = 0; i < length; i += 1) {
		const randomIndex = Math.floor(Math.random() * (seed.length - 1));
		key += seed[randomIndex];
	}
	return key;
};

const createServiceAccessKey = (req, res, next) => {
	const { phases } = res.locals;
	const { _id } = req.body;

	Service.findOne({ _id, phase: { $in: phases } }).exec(
		(searchError, service) => {
			const accessKey = generateAccessKey(40);
			if (searchError) {
				next(new APIError('', 500));
			} else if (!service) {
				next(new APIError('', 404));
			} else {
				service.set('accessKey', accessKey);
				service.save((saveError) => {
					if (saveError) {
						next(new APIError(saveError, 422));
					} else {
						res.send({
							service: Object.assign(service.toObject(), {
								accessKey: service.accessKey,
							}),
						});
					}
				});
			}
		}
	);
};

module.exports = {
	createService,
	createServiceAccessKey,
	createServicePlan,
	deleteServicePlan,
	getServiceList,
	getServicePlanList,
	restoreServicePlan,
	updateService,
	updateServicePlan,
	validateServiceAccess,
	withPhases,
};
