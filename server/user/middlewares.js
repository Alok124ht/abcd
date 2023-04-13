const User = require('./user.model').default;
const { getStrippedEmail } = require('../utils/user/email');
const { validateEmail } = require('./authLib');
const APIError = require('../helpers/APIError');
const { getGroupsOfUser } = require('../cache/UserGroups');

const isSignupAllowed = (req, res, next) => {
	const { email, password } = req.body;
	const emailIdentifier = getStrippedEmail(email);

	if (!email || !validateEmail(email) || !validateEmail(emailIdentifier)) {
		// TODO: use joi
		res.status(422).json({ error: { code: 'auth/invalid-email' } });
	} else if (!password || password.length < 6) {
		res.status(422).json({ error: { code: 'auth/weak-password' } });
	} else {
		User.findOne({ emailIdentifier }).then((us) => {
			if (us !== null) {
				res.status(422).json({
					success: false,
					error: { code: 'auth/email-already-in-use' },
				});
			} else {
				next();
			}
		});
	}
};

const validateCreds = (req, res, next) => {
	const { user } = req.body;
	if (!user || !user.email) {
		res.status(422).json({
			error: {
				code: 'auth/invalid-email',
				message: 'Please enter a valid email',
				field: 'email',
			},
		});
	} else if (!user.password) {
		res.status(422).json({
			error: {
				code: 'auth/wrong-password',
				message: 'Please enter password',
				field: 'password',
			},
		});
	} else {
		next();
	}
};

const withUserGroups = (req, res, next) => {
	const { id: userId } = req.payload;
	getGroupsOfUser(userId, (error, userGroups) => {
		if (error) {
			next(new APIError(error, 500));
		} else {
			// eslint-disable-next-line no-param-reassign
			res.locals.userGroups = userGroups;
			next();
		}
	});
};

module.exports = {
	isSignupAllowed,
	validateCreds,
	withUserGroups,
};
