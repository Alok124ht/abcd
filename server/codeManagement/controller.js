const AWS = require('aws-sdk');
const { map, nth, reverse, sortBy, split } = require('lodash');
const APIError = require('../helpers/APIError');
const moment = require('moment');

const s3 = new AWS.S3({
	region: process.env.AVATAR_S3_AWS_REGION,
	accessKeyId: process.env.GENERAL_AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.GENERAL_AWS_SECRET_ACCESS_KEY,
});
const getFrontDeployTimestampsBySubdomains = (req, res, next) => {
	const bucket = 'prepare.production.prepleaf.com';
	s3.listObjectsV2(
		{
			Bucket: bucket,
			Delimiter: '/',
			Prefix: 'current/',
		},
		(error, data) => {
			if (error) {
				next(new APIError(error));
			} else {
				// res.send(data.CommonPrefixes);
				Promise.all(
					map(
						data.CommonPrefixes,
						({ Prefix: prefix }) =>
							new Promise((resolve) => {
								s3.headObject(
									{ Bucket: bucket, Key: `${prefix}index.html` },
									(headError, head) => {
										if (headError) {
											resolve({ error: headError, prefix });
										} else {
											resolve({ prefix, head });
										}
									}
								);
							})
					)
				)
					.then((heads) => {
						res.send(
							map(
								reverse(
									sortBy(
										map(heads, ({ prefix, head, er }) => {
											let lastModified = null;
											if (!er) {
												try {
													if (head.LastModified) {
														lastModified = moment(head.LastModified);
													}
												} catch (e) {
													lastModified = 'ERROR';
												}
											} else {
												lastModified = 'ERROR';
											}
											return {
												subDomain: nth(split(prefix, '/'), -2),
												prefix,
												lastModified,
												error: er,
											};
										}),
										(h) => (h.lastModified === 'ERROR' ? -1 : h.lastModified.unix())
									),
									(h) => {
										const lastModified = h.lastModified;
										return Object.assign({}, h, {
											lastModified: lastModified === 'ERROR' ? lastModified : lastModified,
										});
									}
								)
							)
						);
					})
					.catch((e) => {
						next(new APIError(e, 500));
					});
			}
		}
	);
	// res.send({});
};

module.exports = { getFrontDeployTimestampsBySubdomains };
