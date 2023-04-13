const { map } = require('lodash');
const Service = require('../../models/Service');
const ServiceProvidersRequest = require('../../models/ServiceProvidersRequest');
const ServiceProviders = require('../../models/ServiceProviders');
const APIError = require('../../helpers/APIError');

const approveRequest = (req, res, next) => {
	const { id: userId } = req.payload;
	const { id: requestId } = req.body;
	ServiceProvidersRequest.findById(requestId).exec(
		(searchError, serviceProvidersRequest) => {
			if (searchError) {
				next(new APIError(searchError, 500));
			} else if (!serviceProvidersRequest) {
				next(new APIError('', 404));
			} else {
				const serviceId = serviceProvidersRequest.service;
				serviceProvidersRequest.set('action', 'approve');
				serviceProvidersRequest.set('actionBy', userId);
				ServiceProviders.findOne({ service: serviceId, status: 'active' }).exec(
					(serviceProvidersError, serviceProviders) => {
						if (serviceProvidersError) {
							next(new APIError(serviceProvidersError, 500));
						} else if (!serviceProviders) {
							// next(new APIError(null, 404));
							const serviceProvidersNew = new ServiceProviders({
								service: serviceId,
								items: serviceProvidersRequest.items,
								createdBy: userId,
								status: 'active',
							});
							serviceProvidersNew.save((saveError) => {
								if (saveError) {
									next(new APIError(saveError, 422, true));
								} else {
									serviceProvidersRequest.save((error) => {
										if (error) {
											next(
												new APIError(
													{
														message:
															'Request completed but failed to mark this request as approved',
													},
													500,
													true
												)
											);
										} else {
											res.send({ message: 'Approved successfully' });
										}
									});
								}
							});
						} else {
							// TODO: complete Update Existing
							next(new APIError('Update feature is not available yet', 422, true));
						}
					}
				);
			}
		}
	);
};

const createServiceProvidersRequest = (req, res, next) => {
	const { id: userId } = req.payload;
	const { items, service, status } = req.body;
	const serviceProvidersRequest = new ServiceProvidersRequest({
		createdBy: userId,
		statusRequested: status,
		items,
		service,
	});
	serviceProvidersRequest.save((error) => {
		if (error) {
			next(new APIError(error, 422, true));
		} else {
			res.send({ serviceProvidersRequest });
		}
	});
};

const getServiceProvidersRequests = (req, res, next) => {
	ServiceProvidersRequest.find({ action: { $exists: false } })
		.populate([
			{ path: 'service', populate: { path: 'phase' } },
			{ path: 'createdBy', select: 'email name mobileNumber' },
			{ path: 'items.account' },
		])
		.exec((searchError, items) => {
			if (searchError) {
				next(new APIError(searchError, 500));
			} else {
				res.send({ items });
			}
		});
};

/**
 * get all ServiceProviders items for services
 * for which user has permission
 */
const getMyServiceProvidersList = (req, res, next) => {
	const { phases } = res.locals;
	Service.find({ phase: { $in: phases } })
		.then((services) => {
			ServiceProviders.find({
				service: { $in: map(services, (s) => s._id) },
			}).exec((searchError, items) => {
				if (searchError) {
					next(new APIError(searchError, 500));
				} else {
					res.send({ items });
				}
			});
		})
		.catch((error) => next(new APIError(error, 500)));
};

const myServiceProvidersRequests = (req, res, next) => {
	const { phases } = res.locals;
	Service.find({ phase: { $in: phases } })
		.then((services) => {
			ServiceProvidersRequest.find({
				service: { $in: map(services, (s) => s._id) },
				action: { $exists: false },
			}).exec((searchError, items) => {
				if (searchError) {
					next(new APIError(searchError, 500));
				} else {
					res.send({ items });
				}
			});
		})
		.catch((error) => {
			next(new APIError(error, 500));
		});
};

module.exports = {
	approveRequest,
	createServiceProvidersRequest,
	getMyServiceProvidersList,
	getServiceProvidersRequests,
	myServiceProvidersRequests,
};
