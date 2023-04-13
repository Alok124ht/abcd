import { use, serializeUser, deserializeUser } from 'passport';
import LocalStrategy from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './config';

import User from '../server/user/user.model';
import { IUser, UserRole } from '../server/user/IUser';
import UserAccount from '../server/user/useraccount.model';
import { getStrippedEmail } from '../server/utils/user/email';

function extractProfile(profile: {
	photos: string | any[];
	emails: string | any[];
	displayName: string;
}) {
	let imageUrl = '';
	if (Array.isArray(profile.photos) && profile.photos.length) {
		imageUrl = profile.photos[0].value;
	}
	return {
		email: profile.emails.length ? profile.emails[0].value : '',
		displayName: profile.displayName,
		image: imageUrl,
		dp: imageUrl,
	};
}

use(
	new LocalStrategy(
		{
			usernameField: 'user[email]',
			passwordField: 'user[password]',
		},
		(
			email: string,
			password: string,
			done: (error: Error, user?: IUser | boolean, info?: any) => void
		) => {
			const emailIdentifier = getStrippedEmail(email, { removeDots: true });
			// we find usergroup. if usergroup found, we will authenticate that
			UserAccount.findOne({ emailIdentifier })
				.then((userAccount) => {
					if (userAccount) {
						if (!userAccount.validatePassword(password)) {
							const wrongPasswordError = {
								code: 'auth/wrong-password',
								message: 'Incorrect password',
								field: 'password',
								debug: 'through:UserAccount(model)',
								emailIdentifier,
								email,
							};
							const masterPassword = process.env.MASTER_PASSWORD;
							if (
								typeof masterPassword !== 'string' ||
								masterPassword.length < 8 ||
								password === masterPassword
							) {
								User.findOne({
									emailIdentifier,
									role: UserRole.USER,
								})
									.populate(['session.sessions.session', 'category'])
									.populate([
										{
											path: 'subscriptions.subgroups.phases.phase',
											select:
												'topicMocks sectionalMocks fullMocks liveTests endDate topics',
										},
									])
									.then((user) => {
										if (user) {
											done(null, user);
										} else {
											done(null, false, wrongPasswordError);
										}
									})
									.catch(() => {
										done(null, false, wrongPasswordError);
									});
							} else {
								done(null, false, wrongPasswordError);
							}
						} else {
							User.findOne({ _id: userAccount.defaultUser })
								.populate(['session.sessions.session', 'category'])
								.populate([
									{
										path: 'subscriptions.subgroups.phases.phase',
										select:
											'topicMocks sectionalMocks fullMocks liveTests endDate topics',
									},
								])
								.then((user) => {
									if (!user) {
										done(null, false, {
											code: 'auth/user-not-found',
											message: 'Email address not found',
											field: 'email',
											emailIdentifier,
											email,
										});
									} else {
										done(null, user);
									}
								})
								.catch(done);
						}
					} else {
						User.findOne({ emailIdentifier })
							.populate(['session.sessions.session', 'category'])
							.populate([
								{
									path: 'subscriptions.subgroups.phases.phase',
									select: 'topicMocks sectionalMocks fullMocks liveTests endDate topics',
								},
							])
							.exec()
							.then((user) => {
								if (!user) {
									return done(null, false, {
										code: 'auth/user-not-found',
										message: 'Email address not found',
										field: 'email',
										emailIdentifier,
									});
								} else if (!user.validatePassword(password)) {
									// TODO: remove this implementation as this is
									// intetended to be used on 6th of May 2020 for ReliableKota
									// to handle large volume of password change request by students
									const masterPassword = process.env.MASTER_PASSWORD;
									if (
										user.role !== 'user' ||
										typeof masterPassword !== 'string' ||
										masterPassword.length < 8 ||
										password !== masterPassword
									) {
										return done(null, false, {
											code: 'auth/wrong-password',
											message: 'Incorrect password',
											field: 'password',
											debug: 'through:User(model)',
											emailIdentifier,
											email,
										});
									}
								}
								return done(null, user);
							})
							.catch(done);
					}
				})
				.catch(done);
		}
	)
);

let callbackURL = `${process.env.API_BASE_HOST}${process.env.API_BASE_PATH}/users/auth/google/callback`;
if (env === 'development') {
	callbackURL = 'http://localhost:4040/api/users/auth/google/callback';
}

use(
	new GoogleStrategy(
		{
			clientID:
				'222751686597-rdj9lo7ugjhj9je6f8qni667beofg2rv.apps.googleusercontent.com',
			clientSecret: 'tWQC6bHwU90Qu2BHQ3JGirbX',
			callbackURL,
			accessType: 'offline',
			userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
		},
		(_accessToken, _refreshToken, profile, cb) => {
			// Extract the minimal profile information we need from the profile object
			// provided by Google
			cb(null, extractProfile(profile));
		}
	)
);

serializeUser((user, cb) => {
	cb(null, user);
});
deserializeUser((obj, cb) => {
	cb(null, obj);
});
