import { Router } from 'express';
import {
	list,
	get,
	getOne,
	createSuperGroup,
	createGroup,
	mapTopic,
	subscribe,
	subscribeCat,
	subscribePlacement,
	getColleges,
	assignGroups,
	calibrateUsers,
	removeUserGroups,
	getSuperGroupWithAllSubgroups,
	getAllSuperGroupsWithAllSubgroupsOfClient,
	getPhasesOfSubgroup,
} from './group.controller';
import auth from '../middleware/auth';

const groupRouter = Router();

groupRouter.route('/').get(auth.required, list);
groupRouter.route('/get').get(auth.required, get);
groupRouter.route('/getOne/:supergroup').get(getOne);
groupRouter.route('/newsupergroup').post(auth.required, createSuperGroup);
groupRouter.route('/newgroup').post(auth.required, createGroup);
groupRouter.route('/maptopic').post(auth.required, mapTopic);
groupRouter.route('/subscribe').post(auth.required, subscribe);
groupRouter.route('/subscribeCat').get(auth.required, subscribeCat);
groupRouter
	.route('/subscribePlacement')
	.post(auth.required, subscribePlacement);
groupRouter.route('/getColleges').get(getColleges);
groupRouter.route('/assignGroups').post(auth.required, assignGroups);

groupRouter.route('/calibrateUsers').post(auth.required, calibrateUsers);

groupRouter.route('/removeUserGroups').post(auth.required, removeUserGroups);

groupRouter
	.route('/getSuperGroupWithAllSubgroups')
	.get(auth.required, getSuperGroupWithAllSubgroups);

groupRouter
	.route('/getAllSuperGroupsWithAllSubgroupsOfClient')
	.get(getAllSuperGroupsWithAllSubgroupsOfClient);

groupRouter
	.route('/getPhasesOfSubgroup')
	.get(auth.required, getPhasesOfSubgroup);

export default groupRouter;
