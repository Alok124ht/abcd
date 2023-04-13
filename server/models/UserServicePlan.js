/* eslint-disable no-await-in-loop */
const mongoose = require('mongoose');
const { subscriptionsIncludePhase } = require('../utils/phase/access');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

/**
 * Services unlocked by user
 */

const UserServicePlanSchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		phase: {
			type: ObjectId,
			ref: 'Phase',
			required: true,
		},
		serviceMachineName: {
			type: String,
			required: true,
		},
		servicePlanRequest: {
			type: ObjectId,
			ref: 'ServicePlanRequest',
		},
		service: {
			type: ObjectId,
			ref: 'Service',
		},
		servicePlan: {
			type: ObjectId,
			ref: 'ServicePlan',
		},
		isExpired: {
			type: Boolean,
			default: false,
		},
		expiresAt: {
			type: Date,
			requred: true,
		},
		/**
		 * Non-null userId means it was created by an admin
		 */
		createdBy: {
			type: ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

UserServicePlanSchema.static(
	'createFromServicePlanRequest',
	async function createFromServicePlanRequest(servicePlanRequest, userId) {
		const { servicePlan } = servicePlanRequest;
		const { services } = servicePlan;
		for (let i = 0; i < services.length; i += 1) {
			const service = services[i];
			// check if user has sibbling user with phase access
			// if not, create a user with phase service.phase
			const User = mongoose.model('User');
			const currentUser = await User.findById(userId);
			const userAccount = await currentUser.getAccount();
			await userAccount.populate('users').execPopulate();
			let userWithCorrectPhase = null;

			await service.populate('phase').execPopulate();
			userAccount.users.some((user) => {
				if (subscriptionsIncludePhase(user.subscriptions, service.phase._id)) {
					userWithCorrectPhase = user;
					return true;
				}
				return false;
			});
			if (!userWithCorrectPhase) {
				await userAccount.addUser(
					service.phase.supergroup,
					service.phase.subgroups[0].subgroup,
					service.phase._id
				);
				userWithCorrectPhase = userAccount.users[userAccount.users.length - 1];
			}

			const instanceForService = new this({
				user: userWithCorrectPhase._id,
				phase: service.phase,
				serviceMachineName: service.machineName,
				servicePlanRequest,
				servicePlan,
				isExpired: false,
				expiresAt: Date.now() + servicePlan.duration,
			});

			await instanceForService.save();
		}
	}
);

module.exports = mongoose.model('UserServicePlan', UserServicePlanSchema);
