const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB({
	region: process.env.AWS_REGION,
	accessKeyId: process.env.GENERAL_AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.GENERAL_AWS_SECRET_ACCESS_KEY,
});
const get = (req, res) => {
	dynamo.getItem(
		{
			Key: { guid: { S: '9cf9d30f-8aee-4641-b259-40e156c098c7' } },
			TableName: 'video-on-demand',
		},
		(error, data) => {
			if (error) {
				res.status(500).send({ success: false });
			} else {
				res.send({ data, success: true });
			}
		}
	);
};

const query = (req, res) => {
	const params = {
		TableName: 'video-on-demand',
		ProjectionExpression: 'egressEndpoints',
		KeyConditionExpression: 'guid = :id',
		ExpressionAttributeValues: {
			// ':srcVideo': { S: 'brief.mp4' },
			':id': { S: '9cf9d30f-8aee-4641-b259-40e156c098c7' },
		},
	};
	dynamo.query(params, (error, data) => {
		if (error) {
			res.status(500).send({ success: false });
		} else {
			res.send({ data, success: true });
		}
	});
};

module.exports = { get, query };
