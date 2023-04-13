import Router from 'express';
import auth from '../middleware/auth';
import {
	addUser,
	getPhases,
	// getSubgroups,
	createToken,
	diasbleToken,
	enableToken,
	getCourses,
	getClientTokens,
} from './addons.controller';
import verify from './middlewares/verify';

const addonsRoutes = Router();

addonsRoutes
	.route('/generate-client-token')
	/*
        client: mandatory to generate auth token for it
    */
	.post(auth.required, createToken);

addonsRoutes
	.route('/get-client-token')
	/*
        client: mandatory to generate auth token for it
    */
	.get(auth.required, getClientTokens);

addonsRoutes
	.route('/disable-client-token')
	/*
        client: optional, to disable all tokens related to client
        token: optional, to disable specific token
    */
	.post(auth.required, diasbleToken);

addonsRoutes
	.route('/enable-client-token')
	/*
        client: optional, to disable all tokens related to client
        token: optional, to disable specific token
    */
	.post(auth.required, enableToken);

addonsRoutes
	.route('/add-user')
	/*
        name, email, mobileNumber, password, username, phase and subgroup; all are required
    */
	.post(verify, addUser);

addonsRoutes.route('/get-phases').post(verify, getPhases);

addonsRoutes.route('/get-courses').post(verify, getCourses);

// addonsRoutes.route('/get-subgroups').post(verify, getSubgroups);

export = addonsRoutes;
