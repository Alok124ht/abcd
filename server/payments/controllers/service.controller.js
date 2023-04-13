const { filter, forEach, includes, some } = require('lodash');
const APIError = require('../../helpers/APIError');
const Service = require('../../models/Service');
const ServicePlan = require('../../models/ServicePlan').default;
const Offer = require('../../models/Offer').default;
const UserServicePlan = require('../../models/UserServicePlan');
import { Types } from 'mongoose';

const getServicePlans = (req, res) => {
	ServicePlan.find({}).exec((searchError, servicePlans) => {
		if (searchError) {
			res
				.status(500)
				.send({ message: 'Database error', errorMessage: searchError.message });
		} else {
			res.send({ servicePlans });
		}
	});
};

const createOffersByServicePlanId = (offers) => {
	const offersByServicePlanId = {};
	const addOfferForServicePlanId = (offer, servicePlanId) => {
		if (!offersByServicePlanId[servicePlanId]) {
			offersByServicePlanId[servicePlanId] = [];
		}
		offersByServicePlanId[servicePlanId].push(offer);
	};
	offers.forEach((offer) => {
		offer.items.forEach((item) => {
			if (item.itemModel === 'ServicePlan') {
				addOfferForServicePlanId(offer, item.value);
			}
		});
	});
	return offersByServicePlanId;
};

const getServicePlansByPhase = async (req, res) => {
	const {
		payload: { phs },
		withOffers = true,
	} = req;
	const { phase } = req.params;
	const machineNames = {};
	const subscribedServices = [];
	const subscribedServiceIds = [];
	const allServices = await Service.find({ phase }).select(
		'_id machineName name'
	);
	if (phs) {
		forEach(phs, (machineNamesMap, phaseId) => {
			if (phaseId === phase) {
				forEach(machineNamesMap, (time, machineName) => {
					machineNames[machineName] = true;
					allServices.forEach((service) => {
						if (service.machineName === machineName) {
							subscribedServices.push(service.toObject());
							subscribedServiceIds.push(service._id.toString());
						}
					});
				});
			}
		});
	}

	ServicePlan.find({})
		.populate([
			{ path: 'services', select: 'phase machineName name description' },
		])
		.exec((searchError, servicePlans) => {
			const servicePlansOfPhase = filter(servicePlans, (servicePlan) =>
				some(servicePlan.services, (service) => service.phase.equals(phase))
			);
			if (searchError) {
				res.status(500).send({
					success: false,
					message: 'Database error',
					errorMessage: searchError.message,
				});
			} else {
				const filteredServicePlans = [];
				servicePlansOfPhase.forEach((plan) => {
					let planFound = true;
					plan.services.forEach((service) => {
						if (!machineNames[service.machineName]) {
							planFound = false;
						}
					});
					if (planFound) {
						plan.subscribed = true;
					} else {
						plan.subscribed = false;
					}
					filteredServicePlans.push({ ...plan._doc, subscribed: !!planFound });
				});
				if (withOffers) {
					Offer.findActiveByServicePlans(
						filteredServicePlans.map((plan) => plan._id)
					)
						.then((offers) => {
							const offersByServicePlanId = createOffersByServicePlanId(
								offers.map((offer) => offer.toObject())
							);
							res.send({
								servicePlans: filteredServicePlans.map((servicePlan) => ({
									...servicePlan,
									offers: offersByServicePlanId[servicePlan._id],
								})),
								success: true,
								subscribedServices,
								subscribedServiceIds,
							});
						})
						.catch((offerSearchError) => {
							res
								.status(500)
								.send({ message: 'Unable to search offers', error: offerSearchError });
						});
				} else {
					res.send({
						success: true,
						servicePlans: filteredServicePlans,
						subscribedServices,
						subscribedServiceIds,
					});
				}
			}
		});
};

const getServicePlansForPhases = async (req, res, next) => {
	const phases = req.query.phases || req.body.phases;
	try {
		const allServicePlans = await ServicePlan.find({}).populate([
			{ path: 'services', select: 'phase machineName name description' },
		]);
		const filteredServicePlans = filter(allServicePlans, (servicePlan) =>
			some(servicePlan.services, (service) =>
				includes(phases, service.phase.toString())
			)
		).map((plan) => plan.toObject());

		Offer.findActiveByServicePlans(filteredServicePlans.map((plan) => plan._id))
			.then((offers) => {
				const offersByServicePlanId = createOffersByServicePlanId(
					offers.map((offer) => offer.toObject())
				);
				res.send({
					items: filteredServicePlans.map((servicePlan) => ({
						...servicePlan,
						offers: offersByServicePlanId[servicePlan._id],
					})),
				});
			})
			.catch((offerSearchError) => {
				res
					.status(500)
					.send({ message: 'Unable to search offers', error: offerSearchError });
			});

		// res.send({ items: filteredServicePlans });
	} catch (e) {
		next(new APIError('Unknown error occurred', 500, true));
		console.error(e);
	}
};

const getServices = (_req, res) => {
	Service.find({}).exec((searchError, services) => {
		if (searchError) {
			res
				.status(500)
				.send({ message: 'Database error', errorMessage: searchError.message });
		} else {
			res.send({ services, success: true });
		}
	});
};

const getServicePlansByUser = async (req, res, next) => {
	const { userId } = req.params;

	try {
		// const plans = await Order.find()
		const plans = await UserServicePlan.aggregate([
			{
				$match: {
					user: Types.ObjectId(userId),
				},
			},
			{
				$lookup: {
					from: 'serviceplans', // name of mongoDB collection, NOT mongoose model
					localField: 'servicePlan',
					foreignField: '_id',
					as: 'details',
				},
			},
			{
				$unwind: '$details',
			},
		]);

		res.send(plans);
	} catch (error) {
		next(error);
	}
};

module.exports = {
	getServicePlans,
	getServicePlansByUser,
	getServicePlansByPhase,
	getServices,
	getServicePlansForPhases,
};
