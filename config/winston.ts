import { createLogger, transports as _transports } from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';
import { createHash } from 'crypto';
import { get } from 'lodash';

require('dotenv').config();

const startTime = new Date().toISOString();
const randomNumber = Math.round(Math.random() * 10000);

const getStreamName = () => {
	const date = new Date().toISOString().split('T')[0];
	return `${date}-${randomNumber}-${createHash('md5')
		.update(startTime)
		.digest('hex')}`;
};

const logger = createLogger({
	transports: [
		new _transports.Console(),
		new _transports.File({ level: 'info', filename: 'combined.log' }),
	],
});

if (['production'].includes(process.env.NODE_ENV)) {
	logger.clear();
}

if (['production'].includes(process.env.NODE_ENV)) {
	const winstonCloudWatchTransport = new WinstonCloudWatch({
		logGroupName: `${process.env.NODE_ENV}/logs`,
		logStreamName: getStreamName,
		awsOptions: {
			credentials: {
				accessKeyId: get(process.env, 'GENERAL_AWS_ACCESS_KEY_ID'),
				secretAccessKey: get(process.env, 'GENERAL_AWS_SECRET_ACCESS_KEY'),
			},
			region: 'ap-south-1',
		},
		jsonMessage: true,
	});
	logger.add(winstonCloudWatchTransport);
}

export default logger;
