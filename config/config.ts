import Joi from 'joi';
import { EnvironmentConfig } from './EnvironmentConfig';

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
})
	.unknown()
	.required();
``;

const { error, value: envVars } = envVarsSchema.validate(process.env);
if (error) {
	throw new Error(`Config validation error: ${error.message}`);
}
let allowedDomains: (string | RegExp)[] = [
	'https://makway.prepseed.com',
	'https://mkway.prepseed.com',
	'https://reliablekota.prepseed.com',
	'https://pccp-reliablekota.prepseed.com',
	'https://brothersacademy.prepseed.com',
	'https://gckirnapur.prepseed.com',
	'https://gckiranpur.prepseed.com',
	'https://mahapragya.prepseed.com',
	'https://rvparankar.prepseed.com',
	'https://school.prepseed.com',
	'https://your-school.prepseed.com',
	'https://lml.prepseed.com',
	'https://vimukta.prepseed.com',
	'https://resonance.prepseed.com',
	'https://edustation.prepseed.com',
	'https://kaydee.prepseed.com',
	'https://gurukul.prepseed.com',
	'https://gprep.prepseed.com',
	'https://newtopper.prepseed.com',
	'https://sciencewing.prepseed.com',
	'https://privilege.prepseed.com',
	'https://ciel-knowledge.prepseed.com',
	'https://master-jee.prepseed.com',
	'https://aryabhatta-classes.prepseed.com',
	'https://icon-academy.prepseed.com',
	'https://ramanujan-jee.prepseed.com',
	'https://vigyas.prepseed.com',
	'https://chanakaya-tutorial.prepseed.com',
	'https://unchaai.prepseed.com',
	'https://coaching.prepseed.com',
	'https://college.prepseed.com',
	'https://mantraprayas.prepseed.com',
	'https://dakshana.prepseed.com',
	'https://bothraclasses.prepseed.com',
	'https://dashboard.prepseed.com',
	'https://admin.prepseed.com',
	'https://prepseed.com',
	'https://www.prepseed.com',
	'https://scientia.prepseed.com',
	'https://prepare.vyasedification.com',
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
};

export = config;
