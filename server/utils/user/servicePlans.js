const getTimeRelativeToJWTExpiry = (jwtExpiryTime, time) => {
	const timeInSeconds = parseInt(time / 1000, 10);
	const diff = jwtExpiryTime - timeInSeconds;
	if (diff <= 0) {
		/**
		 * if it expires after jwt expires
		 */
		return 0;
	}
	/**
	 * If it expires before jwt expires
	 */
	return diff;
};

const getJWTContentForUserServicePlans = (userServicePlans, jwtExpiryTime) => {
	const servicesByPhaseId = {};
	userServicePlans.forEach((userServicePlan) => {
		const now = new Date().getTime();
		if (userServicePlan.expiresAt > now) {
			servicesByPhaseId[userServicePlan.phase] = {
				...servicesByPhaseId[userServicePlan.phase],
				[userServicePlan.serviceMachineName]: getTimeRelativeToJWTExpiry(
					jwtExpiryTime,
					(userServicePlan.expiresAt || new Date()).getTime()
				),
			};
		}
	});
	return servicesByPhaseId;
};

const userHasAccessToServiceInPhase = (serviceMachineName, phase, payload) => {
	const servicesByPhaseId = payload.phs;
	try {
		const serviceExpiryTimeDiff = servicesByPhaseId[phase][serviceMachineName];
		if (typeof serviceExpiryTimeDiff !== 'number') {
			return false;
		}
		const serviceExpiryTimeInSeconds = payload.exp - serviceExpiryTimeDiff;
		const nowInSeconds = Date.now() / 1000;
		const isExpired = nowInSeconds - serviceExpiryTimeInSeconds < 0;
		return isExpired;
	} catch (e) {
		return false;
	}
};

module.exports = {
	getJWTContentForUserServicePlans,
	userHasAccessToServiceInPhase,
};
