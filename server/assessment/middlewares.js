const { cloneDeep, includes, some } = require('lodash');
const mongoose = require('mongoose');
const AssessmentWrapperCache = require('../cache/AssessmentWrapper');
const Submission = require('./submission.model').default;
const UserCache = require('../cache/User');
const UserLiveAssessmentCache = require('../cache/UserLiveAssessment');
const { isAtLeastMentor } = require('../utils/user/role');

const { ObjectId } = mongoose.Types;

const isAccessAllowed = (req, res, next) => {
	/*
		If assessment is for specific service plan, access is not allowed.
		If assessment is not available access is not allowed.
		If assessment is already attempted access is not allowed.
		If user don't have enough xp - this case is not checked here.
	*/

	const { phs, id, role } = req.payload;
	const { userGroups } = res.locals;

	const machineNames = {};
	if (phs) {
		Object.keys(phs).forEach((k) => {
			Object.keys(phs[k]).forEach((l) => {
				machineNames[l] = true;
			});
		});
	}

	const { assessmentId } = req.params;

	AssessmentWrapperCache.getWithVisibleForServices(
		assessmentId,
		(_assessmentWrraperSearchError, assessmentWrapper) => {
			if (!assessmentWrapper) {
				res.status(422).json({ message: 'Not found!', success: false });
				return;
			}
			const timeNow = new Date();
			const availableFrom = new Date(assessmentWrapper.availableFrom).getTime();
			if (availableFrom > timeNow.getTime()) {
				res.status(422).json({
					success: false,
					error: { code: 'assessment-not-available-yet' },
				});
				return;
			}
			let accessAllowed = true;
			if (
				assessmentWrapper.visibleForServices &&
				assessmentWrapper.visibleForServices.length
			) {
				accessAllowed = false;
				assessmentWrapper.visibleForServices.forEach((mn) => {
					if (machineNames[mn.machineName]) accessAllowed = true;
				});
			}
			if (!accessAllowed && !isAtLeastMentor(role)) {
				res.status(422).json({
					success: false,
					error: { code: 'assessment-available-only-for-premium' },
					role,
				});
				return;
			}

			UserCache.getWithLiveAssessment(id, (_err, user) => {
				const phaseMap = {};
				assessmentWrapper.phases.forEach((p) => {
					phaseMap[p.phase] = true;
				});

				let hasPermission = false;
				user.subscriptions.forEach((subscription) => {
					subscription.subgroups.forEach((subgroup) => {
						subgroup.phases.forEach((p) => {
							if (p.active && phaseMap[p.phase]) {
								hasPermission = true;
							}
						});
					});
				});

				hasPermission =
					hasPermission ||
					some(
						assessmentWrapper.permissions,
						(permission) =>
							permission.itemType === 'UserGroup' &&
							includes(userGroups, permission.item.toString())
					);

				if (!hasPermission && !isAtLeastMentor(role)) {
					res.status(422).json({
						success: false,
						error: { code: 'assessment-not-available-for-this-phase' },
					});
					return;
				}

				Submission.findOne(
					// cache user-assessmentWrapper //tricky
					{
						assessmentWrapper: ObjectId(assessmentId),
						user: ObjectId(id),
					},
					{ _id: 1 }
				).then((submission) => {
					// if live assessment, remove it.
					if (submission !== null) {
						res.status(422).json({
							success: false,
							error: { code: 'assessment-already-attempted' },
						});
						return;
					}
					res.locals.assessmentWrapper = assessmentWrapper;
					res.locals.user = user;
					next();
				});
			});
		}
	);
};

function isAvailableForSubscription(wrapper, subscriptions) {
	let found = false;
	const validPhases = wrapper.phases.map((phase) => phase.phase.toString());

	subscriptions.forEach((subscription) => {
		subscription.subgroups.forEach((subgroup) => {
			subgroup.phases.forEach((phase) => {
				if (phase.active) {
					if (validPhases.indexOf(phase.phase.toString()) !== -1) {
						found = true;
					}
				}
			});
		});
	});
	return found;
}

const withAccessState = (req, res, next) => {
	const phs = req.payload ? req.payload.phs : {};
	const id = req.payload ? req.payload.id : null;

	const isLoggedIn = !!id;

	const machineNames = {};
	if (phs) {
		Object.keys(phs).forEach((k) => {
			Object.keys(phs[k]).forEach((l) => {
				machineNames[l] = true;
			});
		});
	}

	const { wrapperId } = req.params;

	AssessmentWrapperCache.getWithVisibleForServices(
		wrapperId,
		(err, assessmentWrapper) => {
			if (!assessmentWrapper) {
				res
					.status(422)
					.json({ error: { code: 'assessment-not-found' }, success: false });
				return;
			}
			if (!isLoggedIn) {
				res.locals.isLoggedIn = false;
				res.locals.assessmentWrapper = assessmentWrapper;
				next();
			} else {
				UserCache.get(id, (userCacheError, user) => {
					if (userCacheError || !user) {
						res
							.status(422)
							.json({ error: { code: 'user-mismatch' }, success: false });
						return;
					}
					const isAvailableForPhase = isAvailableForSubscription(
						assessmentWrapper,
						user.subscriptions
					);

					// if (!isAvailableForPhase) {
					// 	return res.status(422).json({
					// 		error: { code: 'assessment-not-available-for-this-phase' },
					// 		success: false,
					// 	});
					// } else {
					const timeNow = new Date();
					const availableFrom = new Date(assessmentWrapper.availableFrom).getTime();
					if (availableFrom > timeNow.getTime()) {
						res.status(422).json({
							error: { code: 'assessment-not-available-yet' },
							success: false,
						});
						return;
					}
					let accessAllowed = true;
					if (
						assessmentWrapper.visibleForServices &&
						assessmentWrapper.visibleForServices.length
					) {
						accessAllowed = false;
						assessmentWrapper.visibleForServices.forEach((mn) => {
							if (machineNames[mn.machineName]) accessAllowed = true;
						});
					}

					Submission.findOne(
						// cache user-assessmentWrapper //tricky
						{
							assessmentWrapper: ObjectId(wrapperId),
							user: ObjectId(id),
						},
						{ _id: 1 }
					).then((submission) => {
						const isAlreadyAttempted = !!submission;
						res.locals.isLoggedIn = true;
						res.locals.accessAllowed = accessAllowed;
						res.locals.isAlreadyAttempted = isAlreadyAttempted;
						res.locals.isAvailableForPhase = isAvailableForPhase;
						res.locals.assessmentWrapper = assessmentWrapper;
						next();
					});
					// }
				});
			}
		}
	);
};

const isFlowValid = (req, res, next) => {
	const { flow } = req.body;
	if (Array.isArray(flow)) {
		res.locals.flow = flow;
		next();
	} else if (typeof flow === 'string') {
		// handle this!! this should never be the case, but when sending data through insomnia or ...
		const f = JSON.parse(flow);
		if (Array.isArray(f)) {
			res.locals.flow = f;
			next();
		} else {
			res.status(422).json({
				success: false,
				error: { code: 'invalid-flow' },
			});
		}
	} else {
		res.status(422).json({
			success: false,
			error: { code: 'invalid-flow' },
		});
	}
};

const withUserLiveAssessment = (req, res, next) => {
	UserLiveAssessmentCache.get(req.payload.id, (err, userLiveAssessment) => {
		if (err) {
			res.status(422).json({
				success: false,
				error: { code: 'cache-error' },
			});
			return;
		}
		if (!userLiveAssessment) {
			res.status(422).json({
				success: false,
				error: { code: 'live-assessment-document-missing' },
			});
			return;
		}
		if (userLiveAssessment.assessmentWrapperId) {
			res.locals.userLiveAssessment = cloneDeep(userLiveAssessment);

			next();
		} else {
			res.status(422).json({
				success: false,
				error: { code: 'live-assessment-not-found' },
			});
		}
	});
};

const isResponseValid = (req, res, next) => {
	const { response } = req.body;
	if (typeof response === 'object') {
		res.locals.response = response;
		next();
	} else if (typeof response === 'string') {
		// handle this!! this should never be the case, but when sending data through insomnia or ...
		try {
			const r = JSON.parse(response); // try catch
			if (typeof r === 'object') {
				res.locals.response = r;
				next();
			} else {
				res.status(422).json({
					success: false,
					error: { code: 'invalid-response' },
				});
				return;
			}
		} catch (err) {
			res.status(422).json({
				success: false,
				error: { code: 'invalid-response' },
			});
		}
	} else {
		res.status(422).json({
			success: false,
			error: { code: 'invalid-response' },
		});
	}
};

module.exports = {
	isAccessAllowed,
	withAccessState,
	isFlowValid,
	isResponseValid,
	withUserLiveAssessment,
};
