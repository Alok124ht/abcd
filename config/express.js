const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const compress = require('compression');
const methodOverride = require('method-override');
const cors = require('cors');
const httpStatus = require('http-status');
const expressWinston = require('express-winston');
const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
const expressValidation = require('express-validation');
const helmet = require('helmet');
const routes = require('../index.route');
const config = require('./config');
const APIError = require('../server/helpers/APIError');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const crypto = require('crypto');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.text());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser());
app.use(compress());
app.use(methodOverride());

app.use(passport.initialize());
app.use(passport.session());

// secure apps by setting various HTTP headers
app.use(helmet());

// enable CORS - Cross Origin Resource Sharing
const whitelist = [
	process.env.UI_BASE_HOST,
	process.env.UI_MENTORSHIP_BASE_URL,
	process.env.UI_PREPATION_PORTAL_BASE_URL,
	process.env.UI_ADMIN_PORTAL_BASE_URL,
	process.env.API_BASE_HOST,
	process.env.PAYMENT_GATEWAY_HOST,
	...config.cors.allowedDomains,
];

const corsOptions = {
	// origin: function verifyOrigin(origin, callback) {
	// 	if (
	// 		!origin ||
	// 		whitelist.indexOf(origin) !== -1 ||
	// 		/(.)*prepseed.com$/.test(origin) ||
	// 		/(.)*prepseed.com$/.test(origin) ||
	// 		process.env.NODE_ENV === 'development'
	// 	) {
	// 		callback(null, true);
	// 	} else {
	// 		callback(new Error('Not allowed by CORS'));
	// 	}
	// },
	origin: [...whitelist],
	credentials: true,
	methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
};

app.use(cors(corsOptions));

const sessionConfig = {
	resave: false,
	saveUninitialized: false,
	secret: process.env.SESSION_SECRET,
	signed: true,
	store: new MongoStore({
		url: `${config.mongo.baseUri}/${config.mongo.sessionDbName}`,
	}),
};

app.use(session(sessionConfig));
const logTransports = [];
const errorLogTransports = [];
const startTime = new Date().toISOString();

const getStreamName = () => {
	// Spread log streams across dates as the server stays up
	const date = new Date().toISOString().split('T')[0];
	return `${date}-${crypto.createHash('md5').update(startTime).digest('hex')}`;
};
// log error to console only in development env
if (config.env === 'development') {
	const consoleTransport = new winston.transports.Console();
	logTransports.push(consoleTransport);
	errorLogTransports.push(consoleTransport);
}

if (['development', 'production'].includes(config.env)) {
	const winstonCloudWatch = new WinstonCloudWatch({
		logGroupName: `${config.env}/requests`,
		logStreamName: getStreamName,
	});
	logTransports.push(winstonCloudWatch);
	const winstonCloudWatchErrorTransport = new WinstonCloudWatch({
		logGroupName: `${config.env}/errors`,
		logStreamName: getStreamName,
	});
	errorLogTransports.push(winstonCloudWatchErrorTransport);
}

if (logTransports.length) {
	const expressWinstonLogger = expressWinston.logger({
		transports: logTransports,
		format: winston.format.combine(
			winston.format.json(),
			winston.format.prettyPrint()
		),
		colorize: false,
	});
	app.use(expressWinstonLogger);
}

try {
	// mount all routes on /api path
	app.use(process.env.API_BASE_PATH, routes);
} catch (err) {
	app.use((req, res, next) => {
		res.send({ success: false, msg: err.message });
	});
}

// if error is not an instanceOf APIError, convert it.
app.use((err, req, res, next) => {
	if (err instanceof expressValidation.ValidationError) {
		// validation error contains errors which is an array of error each containing message[]
		const unifiedErrorMessage = err.errors
			.map((error) => error.messages.join('. '))
			.join(' and ');
		const error = new APIError(unifiedErrorMessage, err.status, true);
		return next(error);
	}
	if (!(err instanceof APIError)) {
		const apiError = new APIError(err.message, err.status, err.isPublic);
		return next(apiError);
	}
	return next(err);
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
	const err = new APIError('API not found', httpStatus.NOT_FOUND);
	// eslint-disable-next-line no-param-reassign
	res.statusCode = 404;
	return next(err);
});

function shouldSkipErrorLog(req, res, error) {
	if (config.env !== 'development') {
		const skipCodes = [200, 404];
		if (
			skipCodes.includes(error && error.status) ||
			skipCodes.includes(res && res.status) ||
			skipCodes.includes(res && res.statusCode)
		) {
			return true;
		}
	}
	return false;
}

if (errorLogTransports.length) {
	app.use(
		expressWinston.errorLogger({
			transports: errorLogTransports,
			format: winston.format.combine(winston.format.json()),
			meta: false,
			msg: '{{res.status}} {{req.method}} {{req.url}}',
			skip: shouldSkipErrorLog,
		})
	);
}

// error handler, send stacktrace only during development
app.use(
	(
		err,
		req,
		res,
		next // eslint-disable-line no-unused-vars
	) =>
		res.status(err.status).json({
			message: err.isPublic ? err.message : httpStatus[err.status],
			stack: config.env === 'development' ? err.stack : undefined,
		})
);

module.exports = app;
