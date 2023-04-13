const { forEach } = require('lodash');
const PhaseCache = require('../../cache/Phase');

const getActivePhasesFromSubscriptions = (subscriptions) => {
	const activePhases = [];
	forEach(subscriptions, (superGroupItem) => {
		const subGroups = superGroupItem.subgroups;
		forEach(subGroups, (subgroupItem) => {
			const { phases } = subgroupItem;
			forEach(phases, (phase) => {
				if (phase.active) {
					activePhases.push(phase.phase);
				}
			});
		});
	});
	return activePhases;
};

const getDeviceLimit = (user) => {
	const activePhases = getActivePhasesFromSubscriptions(user.subscriptions);
	return new Promise((resolve, reject) => {
		PhaseCache.getMany(activePhases, (error, phases) => {
			if (error) {
				reject(error);
			} else {
				let deviceLimit = Infinity;
				phases.forEach((phase) => {
					if (
						typeof phase.deviceLimit === 'number' &&
						!Number.isNaN(phase.deviceLimit) &&
						phase.deviceLimit !== -1
					) {
						deviceLimit = Math.min(phase.deviceLimit, deviceLimit);
					}
				});
				resolve(deviceLimit);
			}
		});
	});
};

module.exports = {
	getActivePhasesFromSubscriptions,
	getDeviceLimit,
};
