const mongoose = require('mongoose');
const async = require('async');
const { size, some } = require('lodash');
const SubGroupModel = require('./subGroup.model').default;
const SuperGroupModel = require('./superGroup.model').default;
const User = require('../user/user.model').default;
const Client = require('../client/client.model').default;
const Phase = require('../phase/phase.model').default;
const constants = require('../constants.js');
const { secureSubscribedGroups } = require('./lib.js');
const APIError = require('../helpers/APIError');

const { ObjectId } = mongoose.Types;

function filterGroups(groups, phases) {
	const groupMapping = {};
	phases.forEach((phase) => {
		phase.subgroups.forEach((subgroup) => {
			groupMapping[subgroup.subgroup] = true;
		});
	});

	const groupIdx = [];
	groups.forEach((g, sidx) => {
		g.subgroups.forEach((sg, sgidx) => {
			if (groupMapping[sg.subgroup._id]) groupIdx.push({ g: sidx, sg: sgidx });
		});
	});

	const secureGroups = [];

	groupIdx.forEach((gidx) => {
		let found = -1;
		secureGroups.forEach((secg, k) => {
			if (secg._id.toString() == groups[gidx.g]._id.toString()) found = k;
		});

		if (found === -1) {
			secureGroups.push({
				_id: groups[gidx.g]._id,
				name: groups[gidx.g].name,
				isPremium: groups[gidx.g].isPremium,
				subgroups: [groups[gidx.g].subgroups[gidx.sg]],
				topicMocks: groups[gidx.g].topicMocks,
				sectionalMocks: groups[gidx.g].sectionalMocks,
				fullMocks: groups[gidx.g].fullMocks,
				liveTests: groups[gidx.g].liveTests,
			});
		} else {
			secureGroups[found].subgroups.push(groups[gidx.g].subgroups[gidx.sg]);
		}
	});

	return secureGroups;
}

function list(req, res) {
	const {
		payload: { role, id },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
	} else if (role === 'moderator') {
		Client.findOne({ moderators: ObjectId(id) })
			.populate([{ path: 'phases', select: 'subgroups' }])
			.then((client) => {
				if (client) {
					SuperGroupModel.list(false).then((groups) => {
						const filteredGroups = filterGroups(groups, client.phases);
						res.json(filteredGroups);
					});
				} else {
					res.json({ success: false, c: 1 });
				}
			});
		// User.findOne({ _id: id }, { subscriptions: 1 }).then((user) => {
		// 	if (user) {
		// 		SuperGroup.list(false).then((groups) => {
		// 			res.json(subscribedGroups(groups, user.subscriptions));
		// 		});
		// 	} else {
		// 		SuperGroup.list(false).then((groups) => {
		// 			res.json(groups);
		// 		});
		// 	}
		// });
	} else {
		SuperGroupModel.listLite().then((groups) => {
			res.json(groups);
		});
	}
}

function filterPhases(supergroup, clientPhases) {
	const filteredSupergroup = {};
	filteredSupergroup._id = supergroup._id;
	filteredSupergroup.isCollegeRequired = supergroup.isCollegeRequired;
	filteredSupergroup.name = supergroup.name;
	filteredSupergroup.subgroups = [];
	supergroup.subgroups.forEach((sg) => {
		const phases = [];
		sg.subgroup.phases.forEach((p) => {
			const startDate = new Date(p.phase.startDate).getTime();
			const endDate = new Date(p.phase.endDate).getTime();
			const timeNow = new Date().getTime();
			if (timeNow > startDate && timeNow < endDate) {
				if (!clientPhases || clientPhases.indexOf(p.phase._id.toString()) !== -1) {
					phases.push(p);
				}
			}
		});
		if (phases.length) {
			filteredSupergroup.subgroups.push({
				_id: sg._id,
				subgroup: {
					_id: sg.subgroup._id,
					name: sg.subgroup.name,
					isCollegeRequired: sg.subgroup.isCollegeRequired
						? sg.subgroup.isCollegeRequired
						: false,
					phases,
				},
			});
		}
	});
	return filteredSupergroup;
}

const getSuperGroupWithAllSubgroups = (req, res) => {
	const { id, clientId } = req.query;

	if (clientId) {
		Client.findOne({ _id: clientId }, { phases: 1 }).then((client) => {
			if (client) {
				SuperGroupModel.findById(id)
					.select('name isCollegeRequired subgroups')
					.populate([
						{
							path: 'subgroups.subgroup',
							select: 'name phases isCollegeRequired',
							populate: {
								path: 'phases.phase',
								select:
									'name startDate endDate fee hidden enrollmentStartDate enrollmentEndDate',
							},
						},
					])
					.then((supergroup) => {
						const clientPhases = client.phases.map((p) => {
							return p.toString();
						});
						res.send({ item: filterPhases(supergroup, clientPhases) });
					})
					.catch(() => {
						res.status(500).send({ message: 'Internal server error' });
					});
			} else {
				SuperGroupModel.findById(id)
					.select('name isCollegeRequired subgroups')
					.populate([
						{
							path: 'subgroups.subgroup',
							select: 'name phases isCollegeRequired',
							populate: {
								path: 'phases.phase',
								select:
									'name startDate endDate fee hidden enrollmentStartDate enrollmentEndDate',
							},
						},
					])
					.exec((error, superGroup) => {
						if (error) {
							res.status(500).send({ message: 'Internal server error' });
						} else {
							res.send({ item: filterPhases(superGroup, null) });
						}
					});
			}
		});
	} else {
		SuperGroupModel.findById(id)
			.select('name isCollegeRequired subgroups')
			.populate([
				{
					path: 'subgroups.subgroup',
					select: 'name phases isCollegeRequired',
					populate: {
						path: 'phases.phase',
						select:
							'name startDate endDate fee hidden enrollmentStartDate enrollmentEndDate',
					},
				},
			])
			.exec((error, superGroup) => {
				if (error) {
					res.status(500).send({ message: 'Internal server error' });
				} else {
					res.send({ item: filterPhases(superGroup, null) });
				}
			});
	}
};

const getAllSuperGroupsWithAllSubgroupsOfClient = async (req, res, next) => {
	const { client: clientId, superGroups: superGroupIds } = req.query;
	const client = await Client.findOne({ _id: clientId }, { phases: 1 });
	if (!client) {
		next(new APIError(`Invalid client id ${clientId}`, 422, true));
		return;
	}
	try {
		const superGroups = await SuperGroupModel.find({
			_id: { $in: superGroupIds },
		})
			.select('name isCollegeRequired subgroups')
			.populate([
				{
					path: 'subgroups.subgroup',
					select: 'name phases isCollegeRequired',
					populate: {
						path: 'phases.phase',
						select:
							'name startDate endDate fee hidden enrollmentStartDate enrollmentEndDate',
					},
				},
			]);

		const clientPhases = client.phases.map((p) => p.toString());
		const filteredSuperGroups = superGroups
			.map((superGroup) => filterPhases(superGroup, clientPhases))
			.filter((superGroup) =>
				some(superGroup.subgroups, (subGroup) => size(subGroup.subgroup.phases))
			);
		res.send({ items: filteredSuperGroups });
	} catch (e) {
		console.error(e);
		next(new APIError('Unknown error occurred', 500, true));
	}
};

const getPhasesOfSubgroup = (req, res) => {
	const { id } = req.query;
	Phase.find(
		{
			endDate: { $gt: new Date() },
			'subgroups.subgroup': ObjectId(id),
			hidden: { $ne: true },
		},
		{ name: 1, startDate: 1, endDate: 1 }
	)
		.then((phases) => {
			res.json({ success: true, phases });
		})
		.catch(() => {
			res.json({ success: false });
		});
};

const listForUnauthorized = (req, res) => {
	SuperGroupModel.find({ 'subgroups.0': { $exists: true }, isVisible: true })
		.select('name isCollegeRequired isPremium')
		.then((groups) => {
			if (req.query.client === 'MAAN') {
				res.send(groups);
			} else {
				res.send({ groups });
			}
		})
		.catch((e) => {
			console.error(e);
			res.status(500).send({ message: 'Internal server error occurred' });
		});
};

function get(req, res) {
	const {
		payload: { id },
	} = req;
	const t1 = new Date().getTime();
	User.findOne({ _id: id }, { subscriptions: 1 }).then((user) => {
		const t2 = new Date().getTime();
		SuperGroupModel.list(true).then((groups) => {
			const t3 = new Date().getTime();

			res.json({
				success: true,
				groups: secureSubscribedGroups(groups, user.subscriptions),
				times: [t2 - t1, t3 - t2],
			});
		});
	});
}

function getOne(req, res) {
	const { supergroup } = req.params;
	SuperGroupModel.listOne(ObjectId(supergroup)).then((data) => {
		if (data.success) {
			res.set('Cache-Control', 'public, s-maxage=3600');
			res.json({
				success: true,
				groups: [data.group],
			});
		} else {
			res.status(422).json({
				success: false,
				data,
			});
		}
	});
}

function createGroup(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
	} else {
		const { newGroup, superGroupId } = req.body;
		SuperGroupModel.get(superGroupId).then((supergroup) => {
			const group = new SubGroupModel({
				name: newGroup,
				topics: [],
				supergroup: superGroupId,
			});
			group.save().then((savedGroup) => {
				supergroup.subgroups.push({
					subgroup: savedGroup._id,
				});
				supergroup.markModified('subgroups');
				supergroup.save().then(() => {
					res.json({ success: true, groups: supergroup });
				});
			});
		});
	}
}

function createSuperGroup(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
	} else {
		const { newSuperGroup } = req.body;
		const group = new SuperGroupModel({
			name: newSuperGroup,
			subgroups: [],
			leaderboard: [],
		});
		group.save().then(() => {
			SuperGroupModel.list().then((groups) => res.json({ success: true, groups }));
		});
	}
}

function mapTopic(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
	} else {
		const { groupId, topicId } = req.body;
		SubGroupModel.findById(groupId).then((group) => {
			// check if topic id exists!!!!!!
			let found = false;
			group.topics.forEach((topic) => {
				if (topic.topic === topicId) found = true;
			});
			if (!found) {
				group.topics.push({ topic: topicId });
				group.save().then(() => {
					SuperGroupModel.list().then((groups) =>
						res.json({ success: true, groups })
					);
				});
			} else {
				res.json({ success: false });
			}
		});
	}
}

function subscribe(req, res) {
	const newCategories = req.body.categories;
	let ids = [];
	newCategories.forEach((group) => {
		ids.push(group._id);
	});
	Group.getMany(ids).then((groups) => {
		// Group??? check if subscription is working!
		if (newCategories.length === groups.length) {
			User.get(req.payload.id).then((user) => {
				let verifiedNewGroups = [];
				newCategories.forEach((nc) => {
					if (nc.subscribed) verifiedNewGroups.push({ group: nc._id });
				});
				user.subscriptions = verifiedNewGroups;
				user.markModified('subscriptions');
				user.save().then(() => {
					res.json({ success: true });
				});
			});
		} else {
			res.json({ success: false });
		}
	});
}

function findSubscription(subscriptions, group) {
	let found = -1;
	subscriptions.forEach((subscription, idx) => {
		if (subscription.group === group._id.toString()) found = idx;
	});
	return found;
}

function subscribeCat(req, res) {
	SuperGroupModel.getOneByName('CAT', [
		{ path: 'subgroups.subgroup', select: 'name' },
	]).then((supergroup) => {
		if (supergroup.subgroups.length === 1) {
			const supergroupId = supergroup._id;
			const subgroupId = supergroup.subgroups[0].subgroup._id;
			User.get(req.payload.id).then((user) => {
				const superGroupIdx = findSubscription(user.subscriptions, supergroupId);
				if (superGroupIdx === -1) {
					user.subscriptions.push({
						group: supergroupId,
						rating: [],
						overall_rank: [],
						subgroups: [],
					});
					user.subscriptions[user.subscriptions.length - 1].subgroups.push({
						group: subgroupId,
						overall_rank: [],
						active: true,
					});
					if (user.demoStep === 2) {
						// ie. goal demo is still pending
						user.demoStep = 4;
						user.markModified('demoStep');
					} else if (user.demoStep === 3) {
						user.demoStep = 5;
						user.markModified('demoStep');
					}

					// Userxp.update(
					// 	{ _id: user.netXp.xp },
					// 	{
					// 		$push: {
					// 			xp: {
					// 				val: constants.xp.new_subscription,
					// 				reference: user._id,
					// 				onModel: 'User',
					// 				description: `new-subscription-${subgroupId}`,
					// 			},
					// 		},
					// 	}
					// )
					// 	.exec()
					// 	.then(() => {
					// 		user.netXp.val += constants.xp.new_subscription;
					// 		user.markModified('netXp.val');
					user.markModified('subscriptions');
					user.save().then(() => {
						res.json({ supergroupId, subgroupId });
					});
					// });
				} else {
					const subGroupIdx = findSubscription(
						user.subscriptions[superGroupIdx].subgroups,
						subgroupId
					);
					if (subGroupIdx === -1) {
						user.subscriptions[superGroupIdx].subgroups.push({
							group: subgroupId,
							overall_rank: [],
							active: true,
						});

						// Userxp.update(
						// 	{ _id: user.netXp.xp },
						// 	{
						// 		$push: {
						// 			xp: {
						// 				val: constants.xp.new_subscription,
						// 				reference: user._id,
						// 				onModel: 'User',
						// 				description: `new-subscription-${subgroupId}`,
						// 			},
						// 		},
						// 	}
						// )
						// 	.exec()
						// 	.then(() => {
						// 		user.netXp.val += constants.xp.new_subscription;
						user.markModified('netXp.val');
						user.markModified('subscriptions');
						user.save().then(() => {
							res.json({ supergroupId, subgroupId });
						});
						// });
					} else {
						if (
							user.subscriptions[superGroupIdx].subgroups[subGroupIdx].active === false
						) {
							user.subscriptions[superGroupIdx].subgroups[subGroupIdx].active = true;
							user.markModified('subscriptions');
							user.save().then(() => {
								res.json({ supergroupId, subgroupId });
							});
						} else {
							res.json({ success: false, msg: 'already subscribed' });
						}
					}
				}
			});
		} else {
			res.json({ success: false });
		}
	});
}

function subscribePlacement(req, res) {
	const { group } = req.body;
	SuperGroupModel.getOneByName('Placement', [
		{ path: 'subgroups.subgroup', select: 'name' },
	]).then((supergroup) => {
		let found = false;
		supergroup.subgroups.forEach((sg) => {
			if (sg.subgroup._id.toString() === group) found = true;
		});
		if (!found) {
			res.json({ success: false, error: { code: 'subtopic-not-found' } });
		} else {
			User.get(req.payload.id).then((user) => {
				const supergroupId = supergroup._id;
				const superGroupIdx = findSubscription(user.subscriptions, supergroupId);
				if (superGroupIdx === -1) {
					user.subscriptions.push({
						group: supergroupId,
						rating: [],
						overall_rank: [],
						subgroups: [],
					});
					user.subscriptions[user.subscriptions.length - 1].subgroups.push({
						group,
						overall_rank: [],
						active: true,
					});
					user.markModified('subscriptions');
					user.save().then(() => {
						res.json({ supergroupId, group });
					});
				} else {
					const subGroupIdx = findSubscription(
						user.subscriptions[superGroupIdx].subgroups,
						group
					);
					if (subGroupIdx === -1) {
						user.subscriptions[superGroupIdx].subgroups.push({
							group,
							overall_rank: [],
							active: true,
						});
						user.markModified('subscriptions');
						user.save().then(() => {
							res.json({ supergroupId, group });
						});
					} else {
						if (user.subscriptions[superGroupIdx].subgroups[group].active === false) {
							user.subscriptions[superGroupIdx].subgroups[group].active = true;
							user.markModified('subscriptions');
							user.save().then(() => {
								res.json({ supergroupId, group });
							});
						} else {
							res.json({ success: false, msg: 'already subscribed' });
						}
					}
				}
			});
		}
	});
}

function getColleges(req, res) {
	SuperGroupModel.getOneByName('Placement', [
		{ path: 'subgroups.subgroup', select: 'name' },
	]).then((supergroup) => {
		res.json({ success: true, supergroup });
	});
}

function assignGroups(req, res) {
	// only for admin
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false, error: { code: 'asdsd' } });
	} else {
		const newGroups = req.body.groups;
		const ids = [];
		newGroups.forEach((group) => {
			ids.push(group._id);
		});
		SubGroupModel.find({ _id: ids }).then((groups) => {
			if (newGroups.length === groups.length) {
				User.get(req.body.id).then((user) => {
					user.subscriptions.forEach((g, idx) => {
						user.subscriptions[idx].active = false;
					});
					groups.forEach((group) => {
						let found = -1;
						user.subscriptions.forEach((g, idx) => {
							if (g.group == group._id.toString()) found = idx;
						});
						if (found !== -1) {
							user.subscriptions[found].active = true;
						} else {
							// push
							user.subscriptions.push({
								group: group._id,
								rating: [],
								overall_rank: [],
								k: constants.initialQuestionRatingMedium, //change this to default
								active: true,
							});
						}
					});
					user.markModified('subscriptions');
					user.save().then(() => {
						res.json({ success: true });
					});
				});
			} else {
				res.json({ success: false });
			}
		});
	}
}

function calibrateUsers(req, res) {
	// wtf?? // check this api!!
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}
	const { id } = req.body;
	SuperGroupModel.get(id, { subgroups: 1 }).then((group) => {
		const asyncfunctions = group.subgroups.map((subgroup) => {
			return function (done) {
				User.find(
					{ 'subscriptions.subgroups.group': subgroup.subgroup },
					{ _id: 1 }
				)
					.count()
					.then((count) => {
						SubGroupModel.update(
							{ _id: subgroup.subgroup },
							{ $set: { users: count } }
						).exec();
						done(null);
					});
			};
		});

		async.waterfall(asyncfunctions, function (err) {
			if (err) res.status(422).json({ err });
			else {
				SuperGroupModel.listSubgroupUsers().then((groups) => {
					res.json(groups);
				});
			}
		});
	});
}

function removeUserGroups(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}
	const { id } = req.body;
	User.get(id).then((user) => {
		user.subscriptions = [];
		user.save().then(() => {
			res.json({ success: true });
		});
	});
}

module.exports = {
	list,
	listForUnauthorized,
	get,
	getOne,
	createSuperGroup,
	removeUserGroups,
	createGroup,
	mapTopic,
	subscribe,
	subscribeCat,
	subscribePlacement,
	getColleges,
	assignGroups,
	calibrateUsers,
	getSuperGroupWithAllSubgroups,
	getAllSuperGroupsWithAllSubgroupsOfClient,
	getPhasesOfSubgroup,
};
