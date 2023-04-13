/**
 * Config should be imported first
 */
import config from './config/config';
/**
 * We can import other modules now
 */
import mongoose from 'mongoose';
import util from 'util';
import http from 'http';

// config should be imported before importing any other file
import app from './config/express';
import logger from './config/winston';
import './config/passport'; // is this even used?
import { setUpExitListeners } from './config/error-handling';

app.set('view engine', 'pug');
app.set('trust proxy', true);

const dbDebug = require('debug')('db');

// make bluebird default Promise
Promise = require('bluebird'); // eslint-disable-line no-global-assign

// plugin bluebird promise in mongoose
mongoose.Promise = Promise;

// connect to mongo db
const mongoUri = `${config.mongo.baseUri}/${config.mongo.mainDbName}`;
mongoose.connect(mongoUri, { useNewUrlParser: true, useFindAndModify: true });
mongoose.connection.on('error', () => {
	logger.info('Unable to connect to database');
	throw new Error(`unable to connect to database: ${mongoUri}`);
});

// print mongoose logs in dev env
if (config.mongooseDebug) {
	mongoose.set(
		'debug',
		(collectionName: string, method: string, query: any, doc: any) => {
			dbDebug(`${collectionName}.${method}`, util.inspect(query, false, 20), doc);
		}
	);
}

// module.parent check is required to support mocha watch
// src: https://github.com/mochajs/mocha/issues/1912
if (!module.parent) {
	const server = http.createServer(app);
	server.listen(config.port, () => {
		console.info(`Server started on port ${config.port} (${config.env})`); // eslint-disable-line no-console
	});
	setUpExitListeners(server);
}

require('./server/globals/Scheduler');

module.exports = app;
