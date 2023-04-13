import { map, size } from 'lodash';
import { Types } from 'mongoose';
import AWS from 'aws-sdk';
import logger from '../../../config/winston';

const cloudfront = new AWS.CloudFront({
	region: process.env.AVATAR_S3_AWS_REGION,
	accessKeyId: process.env.GENERAL_AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.GENERAL_AWS_SECRET_ACCESS_KEY,
});

export const clearPhaseWrapperCache = (
	phaseIds: (Types.ObjectId | string)[]
) => {
	const items = map(phaseIds, (phaseId) => `/assessment/getwrappers/${phaseId}`);
	const cloudfrontParams = {
		DistributionId: 'EUC5JJZ6DEF7A',
		InvalidationBatch: {
			CallerReference: Date.now().toString(),
			Paths: {
				Quantity: size(items),
				Items: items,
			},
		},
	};
	logger.info('clearing cloudfront cache for phases');
	cloudfront.createInvalidation(cloudfrontParams, (error) => {
		if (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			logger.info(
				`error occurred while clearing cloudfront cache for wrappers of phases, cf paths ${items.join(
					', '
				)}`
			);
		} else {
			logger.info('cleared cloudfront cache for phsaes');
		}
	});
};
