import { createLogger, transports as _transports } from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';
import { createHash } from 'crypto';
import { env } from './config';

const startTime = new Date().toISOString();
const randomNumber = Math.round(Math.random() * 10000);

const getStreamName = () => {
	const date = new Date().toISOString().split('T')[0];
	return `${date}-${randomNumber}-${createHash('md5')
		.update(startTime)
		.digest('hex')}`;
};

const logger = createLogger({
	transports: [new _transports.Console()],
});

if (['production'].includes(env)) {
	logger.clear();
}

if (['production'].includes(env)) {
	const winstonCloudWatchTransport = new WinstonCloudWatch({
		logGroupName: `${env}/logs`,
		logStreamName: getStreamName,
	});
	logger.add(winstonCloudWatchTransport);
}

export default logger;
