const { difference, filter, forEach, isEmpty, map, size } = require('lodash');
const { convertArrayToCSV } = require('convert-array-to-csv');
const async = require('async');
const UserServicePlan = require('../../models/UserServicePlan');
const Service = require('../../models/Service');
const APIError = require('../../helpers/APIError');
const TokenCache = require('../../cache/Token');
const ServicePlanRequest = require('../../models/ServicePlanRequest');
const UserModel = require('../../user/user.model').default;
const { subscriptionsIncludePhase } = require('../../utils/phase/access');
const PhaseModel = require('../../phase/phase.model').default;

const arePhasesAllowed = (allPhases, userProvidedPhases) =>
	size(difference(userProvidedPhases, allPhases)) === 0;

const createUserServicePlan = async (req, res, next) => {
	const { id: adminUserId } = req.payload;
	const {
		phase: phaseId,
		serviceMachineName,
		service: serviceId,
		user: userId,
		expiresAt,
	} = req.body;
	let userWithCorrectPhase = null;
	const currentUser = await UserModel.findById(userId);

	const userAccount = await (await currentUser.getAccount())
		.populate('users')
		.execPopulate();

	userAccount.users.some((user) => {
		if (subscriptionsIncludePhase(user.subscriptions, phaseId)) {
			userWithCorrectPhase = user;
			return true;
		}
		return false;
	});
	const phase = await PhaseModel.findById(phaseId);
	if (!userWithCorrectPhase) {
		await userAccount.addUser(
			phase.supergroup,
			phase.subgroups[0].subgroup,
			phase._id
		);
		userWithCorrectPhase = userAccount.users[userAccount.users.length - 1];
	}
	const userServicePlan = new UserServicePlan({
		phase: phaseId,
		serviceMachineName,
		service: serviceId,
		user: userWithCorrectPhase._id,
		expiresAt,
		createdBy: adminUserId,
	});
	userServicePlan.save((saveError) => {
		if (saveError) {
			next(new APIError(saveError.message, 422, true));
		} else {
			res.send({ userServicePlan });
		}
	});
};

const issueServicePlanToUsers = async (req, res) => {
	const { users: userIds, servicePlan: servicePlanId } = req.body;
	const { id: adminUserId } = req.payload;
	async.series(
		map(userIds, (userId) => (callback) => {
			async function run() {
				try {
					const servicePlanRequest = new ServicePlanRequest({
						user: userId,
						servicePlan: servicePlanId,
						state: 'created',
						lifeCycle: [{ state: 'created' }],
						createdBy: adminUserId,
					});
					await servicePlanRequest.save();
					await servicePlanRequest.markPaid();
					callback(null, servicePlanRequest.toObject());
				} catch (e) {
					callback(null, userId);
				}
			}
			run();
		}),
		(error, results) => {
			const failedUserIds = filter(
				results,
				(result) => typeof result === 'string'
			);
			const successfulUserIds = filter(
				results,
				(result) => typeof result !== 'string'
			).map((result) => result.user);
			res.send({
				successful: successfulUserIds,
				failed: failedUserIds,
			});
		}
	);
};

const getUserServicePlans = (req, res, next) => {
	const {
		phases,
		hasCreatedBy,
		serviceMachineNames,
		users: userIds,
	} = req.query;
	let { skip, limit } = req.query;
	const { phases: allowedPhases } = res.locals;

	if (!arePhasesAllowed(allowedPhases, phases)) {
		next(new APIError('One or more phases invalid phases', 422, true));
		return;
	}

	skip = parseInt(skip, 10);
	if (Number.isNaN(skip)) {
		skip = 0;
	}

	limit = parseInt(limit, 10);
	if (!limit || Number.isNaN(limit)) {
		limit = 20;
	}
	const phasesToSearch = isEmpty(phases) ? allowedPhases : phases;
	const query = { phase: { $in: phasesToSearch } };

	if (!isEmpty(serviceMachineNames) && Array.isArray(serviceMachineNames)) {
		query.serviceMachineName = { $in: serviceMachineNames };
	}

	if (hasCreatedBy === 0 || hasCreatedBy === '0') {
		query.createdBy = {
			$exists: false,
		};
	} else if (hasCreatedBy === 1 || hasCreatedBy === '1') {
		query.createdBy = { $exists: true };
	}
	if (!isEmpty(userIds)) {
		query.user = {
			$in: userIds,
		};
	}
	UserServicePlan.find(query)
		.sort({ createdAt: -1 })
		.skip(skip)
		.limit(limit)
		.populate([
			{ path: 'user', select: 'name email mobileNumber' },
			{
				path: 'servicePlanRequest',
				populate: { path: 'order', populate: { path: 'coupon', select: 'code' } },
			},
		])
		.exec((searchError, userServicePlans) => {
			if (searchError) {
				next(new APIError(searchError, 500, false));
			} else {
				UserServicePlan.countDocuments(query, (countError, count) => {
					res.send({ items: userServicePlans, count });
				});
			}
		});
};

const getUserServicePlan = (req, res, next) => {
	const { userServicePlanId } = req.params;
	const { phases: allPhases } = res.locals;
	UserServicePlan.findOne({
		_id: userServicePlanId,
		phase: { $in: allPhases },
	})
		.populate([
			{ path: 'user', select: 'name email mobileNumber' },
			{
				path: 'servicePlanRequest',
				populate: {
					path: 'servicePlan',
					select: 'name',
				},
			},
		])
		.exec((searchError, userServicePlan) => {
			if (searchError) {
				next(new APIError('', 500));
			} else if (!userServicePlan) {
				next(new APIError('', 404));
			} else {
				res.send({ userServicePlan });
			}
		});
};

const getUserServicePlansForService = (req, res, next) => {
	const { key: accessKey, i } = req.query;
	const { hasAccess, additionalQuery } = res.locals;
	if (!hasAccess && !accessKey) {
		next(new APIError('Access key not present', 422, true));
	} else {
		const serviceQuery = {
			_id: i,
		};
		if (!hasAccess) {
			serviceQuery.accessKey = accessKey;
		} else {
			forEach(additionalQuery, (v, k) => {
				serviceQuery[k] = v;
			});
		}
		Service.findOne(serviceQuery)
			.populate({ path: 'phase', select: 'name' })
			.exec((serviceSearchError, service) => {
				if (serviceSearchError) {
					next(new APIError(serviceSearchError, 500));
				} else if (!service) {
					next(new APIError('', 404));
				} else {
					const query = {};
					query.serviceMachineName = service.machineName;
					query.phase = service.phase;

					UserServicePlan.find(query)
						.sort({ createdAt: -1 })
						.populate([
							{ path: 'user', select: 'name email mobileNumber' },
							{
								path: 'servicePlanRequest',
								populate: {
									path: 'order',
									populate: { path: 'coupon', select: 'code' },
								},
							},
						])
						.exec((searchError, userServicePlans) => {
							if (searchError) {
								next(new APIError(searchError, 500));
							} else {
								const adminExtraFields = hasAccess ? ['Email', 'Mobile'] : [];
								const header = [
									'User Id',
									...adminExtraFields,
									'Amount Paid (In Rupees)',
									'Is Enrolled By Admin',
									'Enrolled / Paid At',
									'Package valid till',
									'Phase',
									'Service Unique Identifier(Machine Name)',
								];
								const data = map(userServicePlans, (usp) => {
									let amountPaid = 0;
									let enrollByAdmin = 'Yes';
									try {
										amountPaid = usp.servicePlanRequest.order.amount;
										enrollByAdmin = 'No';
									} catch (e) {
										// have already initialized
									}
									const adminExtraFieldValues = hasAccess
										? [usp.user.email, usp.user.mobileNumber]
										: [];
									return [
										usp.user._id,
										...adminExtraFieldValues,
										amountPaid / 100,
										enrollByAdmin,
										usp.createdAt,
										usp.expiresAt,
										service.phase.name,
										service.machineName,
									];
								});
								const csv = convertArrayToCSV(data, {
									header,
								});
								res.attachment('purchases.csv');
								res.type('text/csv');
								res.send(csv);
							}
						});
				}
			});
	}
};

const removeUserServicePlan = (req, res, next) => {
	const { userServicePlan: userServicePlanId } = req.body;
	const { phases: allPhases } = res.locals;
	UserServicePlan.findOne({
		_id: userServicePlanId,
		phase: { $in: allPhases },
	})
		.then((userServicePlan) => {
			if (userServicePlan) {
				const { user } = userServicePlan;
				UserServicePlan.deleteOne(
					{
						_id: userServicePlanId,
						phase: { $in: allPhases },
					},
					(err, d) => {
						TokenCache.blacklistAll(user, undefined, () => {
							if (err) {
								next(new APIError('Internal Server Error', 500));
							} else {
								res.send(d);
							}
						});
					}
				);
			} else {
				next(new APIError('', 404));
			}
		})
		.catch(() => {
			next(new APIError('', 500));
		});
};

module.exports = {
	createUserServicePlan,
	getUserServicePlan,
	getUserServicePlans,
	issueServicePlanToUsers,
	getUserServicePlansForService,
	removeUserServicePlan,
};
