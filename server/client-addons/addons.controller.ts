import SubGroupModel from '../group/subGroup.model';
import { Types } from 'mongoose';
import { getStrippedEmail } from '../utils/user/email';
import UserModel from '../user/user.model';
import Userxp from '../user/userxp.model';
import constants from '../constants';
import { uploadAvatarInBackground } from '../user/avatar.controller';
import { ClientTokenModel } from './models/clientToken.model';
import { generateClientToken } from './utils/generateClientToken';
import ClientModel from '../client/client.model';
import { filter, forEach, includes, some, toString } from 'lodash';
import ServicePlan from '../models/ServicePlan';
import Offer from '../models/Offer';
import { NextFunction } from 'express';
import APIError from '../helpers/APIError';
const { ObjectId } = Types;

export const addUser = (req: ExpressRequest, res: ExpressResponse) => {
	const { phase, subgroup, name, email, password, username, mobileNumber } =
		req.body;

	if (
		!phase ||
		!subgroup ||
		!name ||
		!email ||
		!password ||
		!username ||
		!mobileNumber
	) {
		res.send({
			success: false,
			message:
				'Please send phase, subgroup, name, email, password, username, mobileNumber in format assigned you, all fields are mandatory',
		});
		return;
	}

	SubGroupModel.find(
		// @ts-ignore
		{ 'phases.phase': ObjectId(phase), _id: ObjectId(subgroup) },
		{ supergroup: 1 }
	).then(async (subgroups) => {
		// check if phase is active!! and does phase exists? isnt subgroup enough!?
		if (subgroups.length === 1) {
			const subscriptions = [
				{
					group: subgroups[0].supergroup,
					subgroups: [
						{
							group: subgroups[0]._id.toString(),
							phases: [
								{
									// @ts-ignore
									phase: ObjectId(phase),
									active: true,
									isAccessGranted: true,
								},
							],
						},
					],
				},
			];

			const strippedEmail = email.replace(/(\r\n|\n|\r)/gm, '');
			const strippedPass = password.replace(/(\r\n|\n|\r)/gm, '');
			const emailIdentifier = getStrippedEmail(strippedEmail);
			const existingUser = await UserModel.findOne({
				$or: [{ username: username }, { emailIdentifier }],
			});
			if (existingUser) {
				res.json({
					success: false,
					error:
						existingUser.emailIdentifier === emailIdentifier
							? 'Email already registered'
							: 'Username already taken',
				});
				return;
			}

			const finalUser = new UserModel({
				email: strippedEmail,
				emailIdentifier,
				name: name,
				mobileNumber: mobileNumber,
				milestones: [
					{
						achievement: 'Joined Prepseed',
						key: '',
						date: new Date(),
					},
				],
				username: username,
				settings: {
					sharing: false,
					goal: [{ date: new Date().toString(), goal: 1 }],
				},
				subscriptions,
				isVerified: true,
			});
			finalUser.setPassword(strippedPass);
			finalUser
				.save()
				.then((savedUser) => {
					const userxp = new Userxp({
						user: savedUser._id,
						xp: [
							{
								val: constants.xp.signup,
								reference: savedUser._id,
								onModel: 'User',
								description: 'signup',
							},
						],
					});
					// @ts-ignore
					savedUser.netXp = {
						val: constants.xp.signup,
					};
					userxp.save().then((savedUserXp) => {
						savedUser.netXp.xp = savedUserXp._id;
						savedUser.markModified('netXp');

						if (
							process.env.NODE_ENV === 'production' ||
							process.env.NODE_ENV === 'staging'
						) {
							uploadAvatarInBackground(savedUser);
						}

						res.json({ success: true });
					});
				})
				.catch((err) => {
					res.json({ success: false });
					console.log('check failed id', err);
				});
		} else {
			res.json({
				success: false,
				message: 'Phase and Subgroup are not appropriate',
			});
		}
	});
};

export const getPhases = (req: ExpressRequest, res: ExpressResponse) => {
	const { token } = req.body;
	ClientTokenModel.findOne({
		token,
		active: true,
	})
		.then((clientToken) => {
			// @ts-ignore
			ClientModel.findById(clientToken.client)
				.populate({
					path: 'phases',
					select: 'name subgroups.subgroup',
					populate: {
						path: 'subgroups.subgroup',
						select: 'name',
					},
				})
				.then((client) => {
					// @ts-ignore
					res.send({ success: true, phases: client.phases });
				})
				.catch((err) => {
					res.send({ success: false, error: err });
				});
		})
		.catch((err) => {
			res.send({ success: false, error: err });
		});
};

// export const getSubgroups = async (
// 	req: ExpressRequest,
// 	res: ExpressResponse
// ) => {
// 	const { phaseId } = req.query;
// 	if (!phaseId) {
// 		res.send({ success: false, message: 'PhaseId is required' });
// 		return;
// 	}
// 	PhaseModel.findById(phaseId)
// 		.select('subgroups')
// 		.populate([
// 			{
// 				path: 'subgroups.subgroup',
// 				select: 'name',
// 			},
// 		])
// 		.then((phase) => {
// 			res.send({ success: true, phase });
// 		})
// 		.catch((err) => {
// 			res.send({ success: false, error: err });
// 		});
// };

export const createToken = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { client } = req.body;
	if (!client) {
		res.send({ success: false, message: 'client is required' });
		return;
	}
	let runAgain = true;
	while (runAgain) {
		let token = generateClientToken(64);
		let clientToken = await ClientTokenModel.findOne({
			token,
		});
		if (clientToken) {
			continue;
		} else {
			runAgain = false;
			let tokken = new ClientTokenModel({
				token,
				client,
			});
			tokken
				.save()
				.then((token) => {
					if (token) {
						res.send({ success: true, token: token.token });
					} else {
						res.send({ success: false, message: 'Other error' });
					}
				})
				.catch((err) => {
					res.send({ success: false, error: err });
				});
		}
	}
};

export const diasbleToken = (req: ExpressRequest, res: ExpressResponse) => {
	const { client, token } = req.body;
	let toSearch = {};
	if (!client && !token) {
		res.send({
			success: false,
			message: 'Send either client or token to disable',
		});
		return;
	}
	if (client) {
		// @ts-ignore
		toSearch.client = client;
	} else {
		// @ts-ignore
		toSearch.token = token;
	}
	ClientTokenModel.updateMany(toSearch, {
		$set: {
			active: false,
		},
	})
		.then((message) => {
			res.send({
				success: true,
				message,
			});
		})
		.catch((err) => {
			res.send({
				success: false,
				error: err,
			});
		});
};

export const enableToken = (req: ExpressRequest, res: ExpressResponse) => {
	const { client, token } = req.body;
	let toSearch = {};
	if (!client && !token) {
		res.send({
			success: false,
			message: 'Send either client or token to disable',
		});
		return;
	}
	if (client) {
		// @ts-ignore
		toSearch.client = client;
	} else {
		// @ts-ignore
		toSearch.token = token;
	}
	ClientTokenModel.updateMany(toSearch, {
		$set: {
			active: true,
		},
	})
		.then((token) => {
			res.send({
				success: true,
				token,
			});
		})
		.catch((err) => {
			res.send({
				success: false,
				error: err,
			});
		});
};

export const getClientTokens = (req: ExpressRequest, res: ExpressResponse) => {
	const { client } = req.query;
	if (!client) {
		res.send({ success: false, message: 'Client id is not set' });
		return;
	}
	ClientTokenModel.find({
		client: toString(client),
		active: true,
	})
		.then((tokens) => {
			res.send({ success: true, tokens });
		})
		.catch((err) => {
			res.send({ success: false, err });
		});
};

const createOffersByServicePlanId = (offers: any[]) => {
	const offersByServicePlanId: any = {};
	const addOfferForServicePlanId = (offer: any, servicePlanId: any) => {
		if (!offersByServicePlanId[servicePlanId]) {
			offersByServicePlanId[servicePlanId] = [];
		}
		offersByServicePlanId[servicePlanId].push(offer);
	};
	offers.forEach((offer: any) => {
		offer.items.forEach((item: any) => {
			if (item.itemModel === 'ServicePlan') {
				addOfferForServicePlanId(offer, item.value);
			}
		});
	});
	return offersByServicePlanId;
};

export const getCourses = async (
	req: ExpressRequest,
	res: ExpressResponse,
	next: NextFunction
) => {
	const { token } = req.body;
	const clientToken = await ClientTokenModel.findOne({ token });
	const client = await ClientModel.findById(clientToken.client);
	const phases: any[] = [];
	forEach(client.phases, (phase) => {
		phases.push(toString(phase));
	});
	try {
		const allServicePlans = await ServicePlan.find({ deleted: { $ne: true } })
			.select(
				'services currency basePrice description duration name tags createdAt updatedAt thumbNailUrl'
			)
			.sort({ createdAt: -1 })
			.populate([
				{ path: 'services', select: 'phase machineName name description' },
			]);
		const filteredServicePlans = filter(allServicePlans, (servicePlan) =>
			some(servicePlan.services, (service) =>
				// @ts-ignore
				includes(phases, service.phase.toString())
			)
		).map((plan) => plan.toObject());

		// @ts-ignore
		Offer.findActiveByServicePlans(filteredServicePlans.map((plan) => plan._id))
			.then((offers: any) => {
				const offersByServicePlanId = createOffersByServicePlanId(
					offers.map((offer: any) => offer.toObject())
				);
				res.send({
					items: filteredServicePlans.map((servicePlan: any) => ({
						...servicePlan,
						offers: offersByServicePlanId[servicePlan._id],
					})),
				});
			})
			.catch((offerSearchError: any) => {
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
