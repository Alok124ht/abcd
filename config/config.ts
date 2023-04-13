import Joi from 'joi';
import { EnvironmentConfig } from './EnvironmentConfig';
import io from 'socket.io-client';
import logger from './winston';
import constants from '../server/utils/constants';
import dayjs from 'dayjs';

const { socket: socketConstants } = constants;

// require and configure dotenv, will load vars in .env in PROCESS.ENV
require('dotenv').config();

// define validation for all the env vars
const envVarsSchema = Joi.object({
	NODE_ENV: Joi.string()
		.valid('development', 'production', 'test', 'staging')
		.required(),
	PORT: Joi.number().default(4040),
	MONGOOSE_DEBUG: Joi.boolean().when('NODE_ENV', {
		is: Joi.string().equal('development'),
		then: Joi.boolean().default(true),
		otherwise: Joi.boolean().default(false),
	}),
	JWT_SECRET: Joi.string().required().description('JWT Secret required to sign'),
	MONGO_HOST: Joi.string().required().description('Mongo DB host url'),
	MONGO_PORT: Joi.number().default(27017),
	SOCKET_SERVER_BASE: Joi.string().description('Socket Server base is required'),
})
	.unknown()
	.required();

const { error, value: envVars } = envVarsSchema.validate(process.env);
if (error) {
	throw new Error(`Config validation error: ${error.message}`);
}
let allowedDomains: (string | RegExp)[] = [
	'https://prepare.vyasedification.com',
	/^https:\/\/[a-zA-Z0-9.\-]*prepseed.com$/,
];
if (envVars.NODE_ENV === 'development') {
	allowedDomains = [/(.)*/, /(.)*localhost:[0-9]+/];
}

const config: EnvironmentConfig = {
	devPassword: envVars.DEV_PASSWORD,
	env: envVars.NODE_ENV,
	port: envVars.PORT,
	mongooseDebug: envVars.MONGOOSE_DEBUG,
	jwtSecret: envVars.JWT_SECRET,
	emailBounceNotificationToken: envVars.EMAIL_BOUNCE_NOTIFICATION_TOKEN,
	mongo: {
		host: envVars.MONGO_HOST,
		port: envVars.MONGO_PORT,
		baseUri: `mongodb://${envVars.MONGO_HOST}:${envVars.MONGO_PORT}`,
		mainDbName: envVars.MONGO_MAIN_DB_NAME,
		sessionDbName: envVars.SESSION_DB_NAME,
	},
	authCookie: {
		sameSite: process.env.NODE_ENV !== 'development' ? 'none' : 'lax',
		secure: process.env.NODE_ENV !== 'development',
		maxAge: 60 * 24 * 60 * 60 * 1000,
	},
	redis: {
		host: process.env.REDIS_HOST,
		port: parseInt(process.env.REDIS_PORT, 10),
	},
	cors: {
		allowedDomains,
	},
	zoom: {
		clientId: `${process.env.ZOOM_CLIENT_ID}`,
		clientSecret: `${process.env.ZOOM_CLIENT_SECRET}`,
		sdkKey: `${process.env.ZOOM_SDK_KEY}`,
		sdkSecret: `${process.env.ZOOM_SDK_SECRET}`,
	},
	socketBase: `${process.env.SOCKET_SERVER_BASE}`,
	socket: io(`${process.env.SOCKET_SERVER_BASE}`),
	aws: {
		general: {
			accessId: `${process.env.GENERAL_AWS_ACCESS_KEY_ID}`,
			secretKey: `${process.env.GENERAL_AWS_SECRET_ACCESS_KEY}`,
		},
	},
};

const { socket } = config;

const reconnectSocket = () => {
	socket.connect();
};

socket.on('disconnect', (reason, description) => {
	logger.warn(
		`Message: Socket disconnected, Reason: ${reason}, Description: ${description}`
	);
	reconnectSocket();
});

socket.on('connect_error', (err) => {
	logger.error(
		`Message: Socket disconnected, Error Name: ${err.message}, Error Message: ${err.message}`
	);
	reconnectSocket();
});

socket.on('connect', () => {
	const { addClient } = socketConstants;
	logger.info(`Message: Socket Connected on ${dayjs().toString()}`);
	socket.emit(addClient, {
		device: 'Server',
		deviceId: 'Root',
		socketId: socket.id,
	});
});

const { io: socketIO } = socket;

socketIO.on('close', (reason, description) => {
	logger.error(
		`Message: Connection to socket is closed, Reason: ${reason}, Description: ${description}`
	);
});

socketIO.on('error', (err) => {
	logger.error(
		`Message: Error in connection, Error name: ${err.name} Error message: ${err.message}`
	);
});

socketIO.on('reconnect', (attempt) => {
	logger.error(
		`Message: Socket tried to reconnect, reconnectAttempt: ${attempt} `
	);
});

socketIO.on('reconnect_attempt', (attempt) => {
	logger.error(`
		Message: Socket tried to reconnect_attempt,
		reconnectAttempt: ${attempt},
	`);
});

socketIO.on('reconnect_error', (err) => {
	logger.error(
		`Message: Socket Reconnect Error, Error name: ${err.name}, Error message:${err.message}`
	);
});

socketIO.on('reconnect_failed', () => {
	logger.error(`Message: 'Socket Reconnect Failed`);
});

export = config;
