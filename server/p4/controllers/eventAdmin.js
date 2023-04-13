const dynamoose = require('dynamoose');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const ObjectId = require('mongodb').ObjectId;

const User = mongoose.model('User');

if (process.env.NODE_ENV === 'development') {
	try {
		dynamoose.aws.ddb.local('http://localhost:8000');
	} catch (e) {
		console.log(
			'Could not connect to dynamodb. Functionalities which depend on DynamoDB might not work.'
		);
	}
} else {
	const ddb = new dynamoose.aws.sdk.DynamoDB({ region: 'ap-south-1' });

	// Set DynamoDB instance to the Dynamoose DDB instance
	dynamoose.aws.ddb.set(ddb);
}

const getEvents = (req, res, next) => {
	const scan = Event.scan()
		.filter('l')
		.not()
		.eq('')
		.and()
		.filter('a')
		.not()
		.eq('');

	scan.attributes(['a', 'l']).exec((error, results) => {
		if (error) {
			next(error);
		} else {
			const userIds = [];
			results.forEach((item) => {
				if (ObjectId.isValid(item.a)) {
					userIds.push(item.a);
				}
			});
			User.find({ _id: { $in: userIds } })
				.select('name email mobileNumber')
				.exec((userSearchError, users) => {
					if (userSearchError) {
						next(userSearchError);
					} else {
						const usersById = {};
						users.forEach((user) => {
							usersById[user._id] = user;
						});
						res.send({ count: results.length, usersById, results });
					}
				});
		}
	});
};

module.exports = { getEvents };
