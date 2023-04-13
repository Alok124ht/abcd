const _ = require('lodash');
const passport = require('passport');
const nodemailer = require('nodemailer');
const async = require('async');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const querystring = require('querystring');
const EmailTemplates = require('email-templates');
const Attempt = require('../models/Attempt').default;
const User = require('./user.model').default;
const UserAccount = require('./useraccount.model').default;
const Client = require('../client/client.model').default;
const Bucket = require('../bucket/bucket.model').default;
const PreAnalysis = require('../assessment/preAnalysis.model');
const Question = require('../question/question.model').default;
const College = require('../models/College');
const Topic = require('../topic/topic.model').default;
const AssessmentWrapper =
	require('../assessment/assessmentWrapper.model').default;
const Leaderboard = require('../leaderboard/leaderboard.model');
const Submission = require('../assessment/submission.model').default;
const SubGroupModel = require('../group/subGroup.model').default;
const SuperGroupModel = require('../group/superGroup.model').default;
const VerificationToken = require('./verificationToken.model');
const Log = require('../log/log.model');
const Session = require('../session/session.model').default;
const Unsubscribed = require('../email/unsubscribed.model');
const Phase = require('../phase/phase.model').default;

const { notifyUser } = require('../utils/socket');
const emailUtils = require('../utils/mail');
const VisitorUser = require('../models/VisitorUser');
const { getTokenFromHeaders } = require('../utils/auth');
const config = require('../../config/config');
const APIError = require('../helpers/APIError');
const PhaseCache = require('../cache/Phase');
const { getActivePhasesFromSubscriptions } = require('../utils/phase');
const { getUserAgentFromRequest } = require('../utils/request');
const roleUtils = require('../utils/user/role');
const {
	getDefaultSubscriptionFromPhase,
	getDefaultUser,
} = require('./utils/user');

const {
	authFunctions,
	signinFunctions,
	getDefaultSubscription,
	createXpDbReferralVisitor,
} = require('./authLib');
const lib = require('./lib.js');
const constants = require('../constants.js');
const { getCookieHostName } = require('../utils/env');
const { getStrippedEmail } = require('../utils/user/email');

const { secureUser } = lib;
const { userTopics } = lib;

const TokenCache = require('../cache/Token');
const UserCache = require('../cache/User');
const ActivityAndSessionManager = require('../globals/ActivityAndSessionManager');
const lib2 = require('../lib.js'); // all simple functions are declared here, which don't need to be changed/understood

const { getTopicIndex } = lib2;

function get(req, res, next) {
	ActivityAndSessionManager.processActivity(req.payload.id);

	const portalNameRaw = req.query.portal || req.body.portal;
	const portalName = authFunctions[portalNameRaw] ? portalNameRaw : 'other';
	const authFunction = authFunctions[portalName];
	const { supergroup } = req.query;

	try {
		authFunction(req.payload.id, supergroup, req.payload.role).then(
			(response, err) => {
				if (err) {
					res.status(422).json(response);
				} else if (response.error) {
					res.status(422).json(response);
				} else {
					const { user } = response;
					const duration = 1 * 30 * 60000;
					res.json(response);
					ActivityAndSessionManager.processSession(
						user._id,
						new Date(new Date() - duration)
					);
				}
			}
		);
	} catch (e) {
		console.error(e);
		next(new APIError('Failed to authenticate...'));
	}
}

function signin(req, res, next) {
	Log.create({
		user: '',
		role: '',
		api: `users ${req.url}`,
		params: {
			email: _.get(req.body, 'user.email'),
			portal: _.get(req.body, 'portal'),
		},
	});
	const { omitCookies, supergroup } = req.body;

	return passport.authenticate(
		'local',
		{ session: true },
		(err, passportUser, info) => {
			if (err) {
				next(err);
				return;
			}
			if (passportUser) {
				passportUser
					.generateJWT(req)
					.then((token) => {
						const { vid: visitorId } = req.cookies;
						if (visitorId) {
							VisitorUser.findById(visitorId).exec((error, visitor) => {
								if (visitor && !visitor.user) {
									visitor.set('user', passportUser._id);
									visitor.set('convertedBy', 'Sign In');
									visitor.set('signInWith', 'Email');
									visitor.save();
								}
							});
						}
						if (!omitCookies) {
							res.cookie('vid', 'clear', { expires: new Date(0) });
							res.cookie('auth', token, {
								...config.authCookie,
								domain: getCookieHostName(req),
							});
						}

						const pN = req.query.portal || req.body.portal;
						const signinFunction = signinFunctions[pN];

						signinFunction(passportUser, supergroup, passportUser.role)
							.then((response, signInError) => {
								if (signInError) {
									res.status(422).json(response);
								} else {
									const { user } = response;
									const duration = 1 * 30 * 60000;
									// response.token = token;
									res.json({ ...response, token });
									ActivityAndSessionManager.processSession(
										user._id,
										new Date(new Date() - duration)
									);
								}
							})
							.catch((error) => {
								if (error && error.error && error.error.code) {
									res.status(422).send(error);
								} else {
									res.send({ message: 'Unable to Sign In. Please try again.' });
								}
							});
					})
					.catch(() => {
						res.status(500).send({ message: 'Unable to Sign In' });
					});
			} else {
				res.status(400).json({
					error: {
						code: info.code,
						message: info.message,
						field: info.field,
						debug: info.debug,
					},
				});
			}
		}
	)(req, res, next);
}

function signinGoogle(req, res) {
	const redirect = req.session.oauth2return || '/';
	const { noQueryParams } = req.session;
	const referralCode = req.session.code || '';
	const supergroup = req.session.supergroup || '';
	const subgroup = req.session.subgroup || '';
	const client = req.session.client || '';
	// eslint-disable-next-line no-param-reassign
	delete req.session.oauth2return;
	// eslint-disable-next-line no-param-reassign
	delete req.session.code;
	// eslint-disable-next-line no-param-reassign
	delete req.session.supergroup;
	// eslint-disable-next-line no-param-reassign
	delete req.session.subgroup;
	// eslint-disable-next-line no-param-reassign
	delete req.session.client;
	delete req.session.noQueryParams;
	const { user } = req.session.passport; // email, displayName, image
	const { vid: visitorId } = req.cookies;

	if (user.email) {
		const emailIdentifier = getStrippedEmail(user.email);
		User.findOne({ emailIdentifier }).then((user_) => {
			if (user_) {
				user_.generateJWT(req).then((token) => {
					if (visitorId) {
						VisitorUser.findById(visitorId).exec((error, visitor) => {
							if (!error && visitor && !visitor.user) {
								visitor.set('user', user_._id);
								visitor.set('convertedBy', 'Sign In');
								visitor.set('signInWith', 'Google');
								visitor.save();
							}
						});
					}
					const redirectUrl = `${redirect}${
						noQueryParams ? '' : `/dashboard?signInWith=google&token=${token}`
					}`;
					res
						.cookie('auth', token, {
							...config.authCookie,
							domain: getCookieHostName(req),
						})
						.cookie('vid', 'clear', {
							expires: new Date(0),
						})
						.redirect(redirectUrl);
				});
			} else {
				getDefaultSubscription(supergroup, subgroup).then((data) => {
					const { error, subscriptions } = data;
					if (error) {
						res.status(500).send({ error });
					} else {
						const user__ = getDefaultUser(
							user.email,
							Math.random().toString(36).substring(7),
							user.displayName,
							user.dp,
							true,
							subscriptions
						);

						if (client) {
							user__.client = ObjectId(client);
						}

						user__
							.save()
							.then((savedUser) => {
								createXpDbReferralVisitor(savedUser, referralCode, visitorId, 'Google');
								savedUser.generateJWT(req).then((token) => {
									const redirectUrl = `${redirect}${
										noQueryParams ? '' : `/dashboard?signInWith=google&token=${token}`
									}`;
									res.cookie('auth', token, {
										...config.authCookie,
										domain: getCookieHostName(req),
									});
									res.cookie('vid', 'clear', {
										expires: new Date(0),
									});
									res.redirect(redirectUrl);
								});
							})
							.catch((err) => {
								console.log('check err', err);
							});
					}
				});
			}
		});
	} else {
		// shouldn't be the case. handle it
		res.json({});
	}
}

function signup(req, res, next) {
	Log.create({ user: '', role: '', api: `users${req.url}`, params: {} });
	const {
		email,
		password,
		referralCode,
		supergroup,
		subgroup,
		clientId,
		omitCookies,
	} = req.body;
	const { vid: visitorId } = req.cookies;

	getDefaultSubscription(supergroup, subgroup).then((data) => {
		const { error, subscriptions } = data;

		if (error) {
			res.status(500).send({ error });
		} else if (!subscriptions.length) {
			console.log('no supergroup', supergroup, req.body, req.originalUrl);
			next(new APIError('Failed to process, please try again.', 422, true));
		} else {
			const user = getDefaultUser(email, password, '', '', false, subscriptions);
			if (clientId) user.client = clientId;

			user
				.save()
				.then((savedUser_) => {
					const useraccount = new UserAccount({
						users: [savedUser_.id],
						email: savedUser_.email,
						emailIdentifier: savedUser_.emailIdentifier,
						hash: savedUser_.hash,
						salt: savedUser_.salt,
						defaultUser: savedUser_._id,
					});
					useraccount.save().then(() => {
						User.populate(
							savedUser_,
							{
								path: 'subscriptions.subgroups.phases.phase',
								select:
									'topicMocks sectionalMocks fullMocks liveTests endDate topics series',
							},
							(err, savedUser) => {
								if (err) {
									// handle this
								} else {
									createXpDbReferralVisitor(savedUser, referralCode, visitorId, 'Email');
									savedUser.generateJWT(req).then((token) => {
										if (!omitCookies) {
											res.cookie('auth', token, {
												...config.authCookie,
												domain: getCookieHostName(req),
											});
											res.cookie('vid', 'clear', { expires: new Date(0) });
										}
										if (req.body.portal === 'main') {
											res.json({ user: secureUser(savedUser), token });
										} else {
											SuperGroupModel.getNames().then((supergroupNames) => {
												userTopics(savedUser).then((topicData) => {
													res.json({
														user: secureUser(savedUser),
														topics: topicData.topics,
														// leaderboard: topicData.leaderboard,
														difficulty: topicData.difficulty,
														token,
														supergroupNames,
														percentComplete: topicData.percentComplete,
														category: null,
													});
												});
											});
										}
									});
								}
							}
						);
					});
				})
				.catch((error) => {
					res.status(500).send({
						message: 'Unable to create a new user, please try again.',
						debugMessage: error ? error.message : 'Error empty',
					});
				});
		}
	});
}

function signout(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users ${req.url}`,
		params: req.body,
	});
	const {
		headers: { authorization },
		cookies: { auth: token },
	} = req;
	const { id: userId } = req.payload;
	const tokenToRemove = token || authorization;
	return TokenCache.blacklist(
		tokenToRemove,
		userId,
		getUserAgentFromRequest(req),
		{
			logoutIp: req.ip,
		}
	).then(() => {
		res
			.cookie('auth', 'clear', { expires: new Date(0) })
			.cookie('auth', 'clear', {
				expires: new Date(0),
				domain: getCookieHostName(req),
			})
			.json({ success: true });
	});
}

function addAccount(req, res) {
	const { id } = req.payload;
	const { supergroup, subgroup, phase } = req.body;

	if (!supergroup) {
		res.json({ success: false, error: { code: 'supergroup-not-found' } });
	} else if (!subgroup) {
		res.json({ success: false, error: { code: 'subgroup-not-found' } });
	} else if (!phase) {
		res.json({ success: false, error: { code: 'phase-not-found' } });
	} else {
		UserAccount.findOne({ users: ObjectId(id) }).then((userAccount) => {
			if (userAccount) {
				const email = `${userAccount.email}_${Math.floor(Math.random() * 100)}`;

				getDefaultSubscriptionFromPhase(supergroup, subgroup, phase).then(
					(data) => {
						const { error, subscriptions } = data;

						if (error) {
							res.status(500).send({ error });
						} else if (!subscriptions.length) {
							console.log('no supergroup', supergroup, req.body, req.originalUrl);
						} else {
							const user = getDefaultUser(
								email,
								'nopassowrd',
								'',
								'',
								false,
								subscriptions
							);
							user
								.save()
								.then((savedUser_) => {
									userAccount.users.push(savedUser_.id);
									userAccount.markModified('users');
									userAccount.save().then(() => {
										User.populate(
											savedUser_,
											{
												path: 'subscriptions.subgroups.phases.phase',
												select:
													'topicMocks sectionalMocks fullMocks liveTests endDate topics series',
											},
											(err, savedUser) => {
												if (err) {
													// handle this
												} else {
													createXpDbReferralVisitor(savedUser, '', '', 'Email');
													res.json({ success: true });
												}
											}
										);
									});
								})
								.catch((error) => {
									res.status(500).send({
										message: 'Unable to create a new user, please try again.',
										debugMessage: error ? error.message : 'Error empty',
									});
								});
						}
					}
				);
			} else {
				User.findOne({ _id: ObjectId(id) }).then((u) => {
					if (u) {
						const email = `${u.email}_${Math.floor(Math.random() * 100)}`;

						getDefaultSubscriptionFromPhase(supergroup, subgroup, phase).then(
							(data) => {
								const { error, subscriptions } = data;

								if (error) {
									res.status(500).send({ error });
								} else if (!subscriptions.length) {
									console.log('no supergroup', supergroup, req.body, req.originalUrl);
								} else {
									const user = getDefaultUser(
										email,
										'nopassowrd',
										'',
										'',
										false,
										subscriptions
									);
									user
										.save()
										.then((savedUser_) => {
											const userAccount_ = new UserAccount({
												users: [u.id, savedUser_._id],
												email: u.email,
												emailIdentifier: u.emailIdentifier,
												hash: u.hash,
												salt: u.salt,
												defaultUser: u._id,
											});

											userAccount_.save().then(() => {
												User.populate(
													savedUser_,
													{
														path: 'subscriptions.subgroups.phases.phase',
														select:
															'topicMocks sectionalMocks fullMocks liveTests endDate topics series',
													},
													(err, savedUser) => {
														if (err) {
															// handle this
														} else {
															createXpDbReferralVisitor(savedUser, '', '', 'Email');
															res.json({ success: true });
														}
													}
												);
											});
										})
										.catch((error) => {
											res.status(500).send({
												message: 'Unable to create a new user, please try again.',
												debugMessage: error ? error.message : 'Error empty',
											});
										});
								}
							}
						);
					} else {
						res.json({ success: false, e: 2 });
					}
				});
			}
		});
	}
}

const logoutOfOtherDevices = async (req, res, next) => {
	const { id: userId, role } = req.payload;
	const { user: otherUserId } = req.query;
	if (roleUtils.isAtLeast('moderator', role) && otherUserId) {
		const user = await User.findById(otherUserId);
		if (!roleUtils.isAtLeast(user.role, role)) {
			TokenCache.blacklistAll(otherUserId, '', () => {});
		} else {
			next(
				new APIError(
					'You do not have required permission to log out this user',
					422,
					true
				)
			);
			return;
		}
	} else {
		TokenCache.blacklistAll(userId, getTokenFromHeaders(req), () => {});
	}
	res.send({ message: 'Logged out of all other devices successfully' });
};

function updatePassword(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users ${req.url}`,
		params: {},
	});
	const { currentPassword, newPassword } = req.body;

	UserAccount.findOne({ users: ObjectId(req.payload.id) }).then(
		(userAccount) => {
			if (userAccount) {
				if (userAccount.validatePassword(currentPassword)) {
					userAccount.setPassword(newPassword);
					userAccount.save().then(() => {
						TokenCache.blacklistAll(req.payload.id, getTokenFromHeaders(req));
						User.get(req.payload.id).then((user) => {
							user.setPassword(newPassword);
							user.save().then(() => {
								TokenCache.blacklistAll(req.payload.id, getTokenFromHeaders(req));
								res.json({ success: true });
							});
						});
					});
				} else {
					res.json({ error: { code: 'auth/wrong-password' } });
				}
			} else {
				User.get(req.payload.id).then((user) => {
					if (user.validatePassword(currentPassword)) {
						user.setPassword(newPassword);
						user.save().then(() => {
							TokenCache.blacklistAll(req.payload.id, getTokenFromHeaders(req));
							res.json({ success: true });
						});
					} else {
						res.json({ error: { code: 'auth/wrong-password' } });
					}
				});
			}
		}
	);

	// User.get(req.payload.id).then((user) => {
	// 	if (user.validatePassword(currentPassword)) {
	// 		user.setPassword(newPassword);
	// 		user.save().then(() => {
	// 			TokenCache.blacklistAll(req.payload.id, req);
	// 		});

	// 		UserAccount.findOne({ users: user._id }).then((userAccount) => {
	// 			if (userAccount) {
	// 				userAccount.setPassword(newPassword);
	// 				userAccount.save();
	// 				res.json({ success: true });
	// 			} else {
	// 				res.json({ success: true });
	// 			}
	// 		});
	// 	} else {
	// 		res.json({ error: { code: 'auth/wrong-password' } });
	// 	}
	// });
}

function forgotPassword(req, res, next) {
	Log.create({
		user: '',
		role: '',
		api: `users${req.url}`,
		params: req.body,
	});
	const { email } = req.body;
	const { logo } = req.body;
	const origin = req.get('Origin');
	async.waterfall(
		[
			(done) => {
				crypto.randomBytes(20, (err, buf) => {
					const token = buf.toString('hex');
					done(err, token);
				});
			},
			(token, done) => {
				let selector = {};
				const operator = {};
				selector = {
					resetPasswordToken: token,
					resetPasswordExpires: Date.now() + 3600000,
				};
				operator.$set = selector;
				User.update({ email }, operator).then((q) => {
					if (q.nModified === 1) {
						done(null, token);
					} else {
						res.status(422).json({
							error: { code: 'invalid-email' },
						});
					}
				});
			},
			(token) => {
				const emailTemplateClient = new EmailTemplates();
				const resetLinkBaseUrl = `${process.env.UI_BASE_HOST}/reset`;
				const queryString = querystring.stringify({
					token,
					r: origin,
				});
				const resetLink = `${resetLinkBaseUrl}?${queryString}`;
				emailTemplateClient
					.render('user/reset_password', {
						email,
						link: resetLink,
						logo,
					})
					.then((html) => {
						emailUtils.sendEmail(
							{
								to: [email],
								body: html,
								bodyType: 'html',
								subject: 'Prepleaf password reset request',
							},
							(error) => {
								if (error) {
									res.status(422).send({
										success: false,
										message: 'Error occurred while sending email, please try again later',
									});
								} else {
									res.json({ success: true });
								}
							}
						);
					})
					.catch(() => {
						res.status(500).send({
							success: false,
							message: 'Error occurred while creating email from template',
						});
					});
			},
		],
		(err) => {
			if (err) return next(err);
		}
	);
}

function resetPassword(req, res) {
	const { password, token } = req.body;
	User.findOne({
		resetPasswordToken: token,
		resetPasswordExpires: { $gt: Date.now() },
	})
		.then(async (user) => {
			if (user != null) {
				user.setPassword(password);
				user
					.save()
					.then(() => {
						UserAccount.findOne({ users: user._id }).then((userAccount) => {
							if (userAccount) {
								userAccount.setPassword(password);
								userAccount
									.save()
									.then(() => {
										res.json({ success: true, uau: true });
									})
									.catch((error) => {
										res.json({ success: true, uau: false, uauf: true, error });
									});
							} else {
								res.json({ success: true, uau: false });
							}
						});
					})
					.catch((error) => {
						res.status(500).send({ message: 'Unknown error occurred', error });
					});
			} else {
				try {
					const tempUser = await User.findOne({ resetPasswordToken: token });
					res.status(422).json({
						token,
						expiredUserFound: tempUser
							? { _id: tempUser._id, name: tempUser.name }
							: 'not found',
						user: user ? user._id : null,
						success: false,
						t: 1,
						error: { code: 'auth/token-expired' },
					});
				} catch (e) {
					res
						.status(422)
						.send({ success: false, error: { code: 'auth/token-expired' } });
				}
			}
		})
		.catch(() => {
			res.status(500).send({ message: 'Internal server error' });
		});
}

function support(req, res) {
	const { msg } = req.body;
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users ${req.url}`,
		params: req.body,
	});
	const { user } = res.locals;

	const activePhases = getActivePhasesFromSubscriptions(user.subscriptions);
	PhaseCache.getMany(activePhases, (error, phases) => {
		const defaultEmails = ['amit@prepleaf.com', 'aman@prepleaf.com'];
		const recipientsPromise = new Promise((resolve) => {
			Client.find({
				phases: { $in: _.map(phases, (phase) => _.get(phase, '_id')) },
			})
				.then((clients) => {
					const emails = _.concat(
						[],
						..._.map(clients, (client) => {
							const clientEmails = _.get(client, 'support.emails');
							if (_.isEmpty(clientEmails)) {
								return defaultEmails;
							}
							return clientEmails;
						})
					);
					resolve(emails.length ? _.uniq(emails) : defaultEmails);
				})
				.catch(() => {
					resolve(defaultEmails);
				});
		});
		recipientsPromise.then((recipients) => {
			let phasesContent = '';
			if (error) {
				phasesContent = 'Could not find his/her Phases.';
			} else {
				phasesContent = `Phase${_.size(phases) > 1 ? 's' : ''}: ${_.join(
					_.map(phases, (phase) => _.get(phase, 'name'))
				)}`;
			}
			const mailBody = `Feedback/Query from ${user.name}(${user.email})\n${phasesContent}\n${msg}`;
			emailUtils.sendEmail(
				{
					subject: 'Support Required',
					to: recipients,
					body: mailBody,
					bodyType: 'Text',
				},
				() => {}
			);
		});
	});

	res.json({ success: true });
}

function completeProfile(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users ${req.url}`,
		params: req.body,
	});
	const {
		name,
		username,
		mobileNumber,
		supergroup, // verify that supergroup is available
		group, // verify that group is available
		college,
		phase,
	} = req.body;

	SubGroupModel.nameMapAndPhases(supergroup, group).then((data) => {
		const { phases } = data;
		let isPhaseValid = false;
		phases.forEach((ph) => {
			const startDate = new Date(ph.phase.startDate).getTime();
			const endDate = new Date(ph.phase.endDate).getTime();
			const timeNow = new Date().getTime();
			if (ph.phase._id.toString() === phase) {
				if (!(timeNow < startDate) && timeNow > endDate) {
					isPhaseValid = true;
				}
			}
		});

		User.findOne({ username }).then((user_) => {
			if (!user_ || user_._id.toString() === req.payload.id) {
				User.get(req.payload.id).then((user) => {
					user.set('name', name || user.name);
					user.set('username', username || user.username);
					user.set('mobileNumber', mobileNumber || user.mobileNumber);

					if (isPhaseValid) {
						const isAccessGranted_ = !phase.isPrivate;
						let supergroupFound = false;
						user.subscriptions.forEach((s) => {
							if (s.group === supergroup) {
								let found = false;
								s.subgroups.forEach((sg) => {
									if (sg.group === group) {
										found = true;

										sg.phases = [];
										sg.phases.push({
											phase,
											active: true,
											isAccessGranted: isAccessGranted_,
										});
									}
								});
								if (!found) {
									if (!s.subgroups.length) {
										s.subgroups.push({
											group,
											overall_rank: [],
											active: true,
											phases: [{ phase, active: true }],
										});
									} else {
										s.subgroups[0].group = group;
										s.subgroups[0].phases = [{ phase, active: true }];
									}
								}
								supergroupFound = true;
							}
						});
						if (!supergroupFound) {
							user.subscriptions.push({
								group: supergroup,
								rating: [],
								overall_rank: [],
								k: constants.kRating0,
								subgroups: [
									{
										group,
										overall_rank: [],
										active: true,
										phases: [{ phase, active: true }],
									},
								],
							});
						}

						if (isAccessGranted_) {
							user.set('isVerified', true);
						}

						user.markModified('subscriptions');

						if (!_.isEmpty(college)) {
							const col = new College({
								college,
								user: username,
							});
							col.save();
						}

						user.save().then(() => {
							User.populate(
								user,
								[
									{ path: 'session.sessions.session category' },
									{
										path: 'subscriptions.subgroups.phases.phase',
										select: 'topicMocks sectionalMocks fullMocks liveTests series',
									},
								],
								(err) => {
									if (err) {
										res.json({ success: false });
									} else {
										userTopics(user).then((topicData) => {
											res.json({
												user: secureUser(user),
												topics: topicData.topics,
												leaderboard: topicData.leaderboard,
												recommendations: topicData.recommendations,
												difficulty: topicData.difficulty,
											});
										});
									}
								}
							);
						});
						// });
					} else {
						user.markModified('name');
						user.markModified('username');
						user.markModified('mobileNumber');

						if (!_.isEmpty(college)) {
							const col = new College({
								college,
								user: username,
							});
							col.save();
						}

						user.save().then(() => {
							User.populate(
								user,
								[
									{ path: 'session.sessions.session category' },
									{
										path: 'subscriptions.subgroups.phases.phase',
										select: 'topicMocks sectionalMocks fullMocks liveTests series',
									},
								],
								(err) => {
									if (err) {
										res.json({ success: false });
									} else {
										userTopics(user).then((topicData) => {
											res.json({
												user: secureUser(user),
												topics: topicData.topics,
												leaderboard: topicData.leaderboard,
												recommendations: topicData.recommendations,
												difficulty: topicData.difficulty,
											});
										});
									}
								}
							);
						});
					}
				});
			} else {
				res.json({ error: 'username already used' });
			}
		});
	});
}

/**
 * Get user list.
 * @property {number} req.query.skip - Number of users to be skipped.
 * @property {number} req.query.limit - Limit number of users to be returned.
 * @returns {User[]}
 */
function list(req, res, next) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users${req.url}`,
		params: req.body,
	});
	const {
		payload: { role },
	} = req;
	if (req.body.role === 'admin' && role !== 'super') {
		// wtf fuck this??
		res.json({ success: false });
		return;
	}
	if (req.body.role === 'moderator' && role !== 'super' && role !== 'admin') {
		res.json({ success: false });
		return;
	}
	const { limit = 50, skip = 0 } = req.query;
	User.find({ role: req.body.role })
		.skip(skip)
		.limit(limit)
		.then((users) => res.json(users))
		.catch((e) => next(e));
}

function assignCollege(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users${req.url}`,
		params: req.body,
	});
	const { user, college } = req.body;
	if (req.body.role === 'admin' && req.body.role !== 'super') {
		res.json({ success: false });
		return;
	}
	User.findOne({ _id: user })
		.exec()
		.then((user_) => {
			if (user_ && user_.subscriptions.length === 1) {
				if (user_.subscriptions[0].group === '5d10e42744c6e111d0a17d0a') {
					// currently hardcoded!!
					if (user_.subscriptions[0].subgroups.length === 1) {
						if (
							user_.subscriptions[0].subgroups[0].group === '5d10e4b544c6e111d0a17d16'
						) {
							user_.subscriptions[0].subgroups[0].group = college;
							user_.markModified('college');
							user_.save().then(() => {
								College.remove({ user: user_.username }).then(() => {
									res.json({ success: true });
								});
							});
						} else {
							res.json({ success1: false });
						}
					} else {
						res.json({ success2: false });
					}
				} else {
					res.json({ success3: false });
				}
			} else {
				res.json({ success4: false });
			}
		});
}

function others(req, res, next) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users${req.url}`,
		params: req.body,
	});
	if (req.body.role === 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}
	College.find({})
		.exec()
		.then((colleges) => {
			const usernameMap = {};
			const usernames = colleges.map((c) => {
				usernameMap[c.user] = c.college;
				return c.user;
			});
			User.find({ username: { $in: usernames } })
				.sort({ _id: -1 })
				.exec()
				.then((users) => {
					const userids = users.map((u) => u._id);
					Submission.find({ user: { $in: userids }, graded: true })
						.exec()
						.then((submissions) => {
							const invalidUsers = {};
							submissions.forEach((s) => {
								invalidUsers[s.user] = true;
							});
							const validUsers = [];
							users.forEach((u) => {
								if (invalidUsers[u._id] === undefined) {
									u.salt = usernameMap[u.username];
									validUsers.push(u);
								}
							});
							res.json({ users: validUsers });
						});
				})
				.catch((e) => next(e));
		});
}

function updateGoal(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users${req.url}`,
		params: req.body,
	});
	const { id } = req.payload;
	const { goal } = req.body;
	User.updateGoal(id, goal).then((user) => {
		res.json(secureUser(user));
	});
}

function updateAccount(req, res) {
	// combine with update
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users${req.url}`,
		params: req.body,
	});
	const { id } = req.payload;
	const { name, username, mobileNumber, course, supergroup, phase, college } =
		req.body;
	User.findOne({ username }, { _id: 1 }).then((u1) => {
		if (u1 && u1._id.toString() !== id.toString()) {
			res.json({ success: false, error: { code: 'username-used' } });
		} else {
			User.findById(id).then((user) => {
				SubGroupModel.nameMapAndPhases(supergroup, course).then((data) => {
					const { nameMap, phases } = data;
					let isPhaseValid = false;
					let isAccessGranted_ = true;
					phases.forEach((ph) => {
						const startDate = new Date(ph.phase.startDate).getTime();
						const endDate = new Date(ph.phase.endDate).getTime();
						const timeNow = new Date().getTime();
						if (ph.phase._id.equals(phase)) {
							isAccessGranted_ = !ph.phase.isPrivate;
							if (timeNow >= startDate && timeNow <= endDate) {
								isPhaseValid = true;
							}
						}
					});
					if (user) {
						if (college) {
							const col = new College({
								college,
								user: username,
							});
							col.save();
						}

						if (
							user.username.indexOf('NOTSET_') === 0 &&
							username.length >= 6 &&
							username.indexOf(' ') === -1
						) {
							user.username = username;
							user.markModified('username');
						}

						if (name) {
							user.name = name;
							user.markModified('name');
						}
						if (mobileNumber) {
							user.mobileNumber = mobileNumber;
							user.markModified('mobileNumber');
						}

						if (isPhaseValid) {
							// const isAccessGranted_ = phase.isPrivate ? false : true;
							user.subscriptions.forEach((subscription) => {
								if (subscription.group === supergroup) {
									subscription.subgroups.forEach((sg) => {
										if (
											nameMap[sg.group] &&
											nameMap[sg.group] === 'NOT_SET' &&
											nameMap[course] &&
											nameMap[course] !== 'NOT_SET'
										) {
											sg.group = course;
											sg.phases = [];
											sg.phases.push({
												phase,
												active: true,
												isAccessGranted: isAccessGranted_,
											});
											user.markModified('subscriptions');
										}
									});
								}
							});

							if (isAccessGranted_) {
								user.isVerified = true;
								user.markModified('isVerified');
							}

							UserCache.del(user._id);
							// update account always clears cache. can be useful to ask user to update

							user.save().then(() => {
								User.populate(
									user,
									[
										{ path: 'session.sessions.session category' },
										{
											path: 'subscriptions.subgroups.phases.phase',
											select: 'topicMocks sectionalMocks fullMocks liveTests series',
										},
									],
									(err, populatedUser) => {
										if (err) {
											res.json({ success: false });
										} else {
											res.json({ success: true, user: secureUser(populatedUser) });
										}
									}
								);
							});
							// });
						} else {
							UserCache.del(user._id);
							// update account always clears cache. can be useful to ask user to update

							user.save().then(() => {
								User.populate(
									user,
									[
										{ path: 'session.sessions.session category' },
										{
											path: 'subscriptions.subgroups.phases.phase',
											select: 'topicMocks sectionalMocks fullMocks liveTests series',
										},
									],
									(err, populatedUser) => {
										if (err) {
											res.json({ success: false });
										} else {
											res.json({ success: true, user: secureUser(populatedUser) });
										}
									}
								);
							});
						}
					} else {
						res.json({ success: false });
					}
				});
			});
		}
	});
}

function bookmark(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users ${req.url}`,
		params: req.body,
	});
	const { id } = req.payload;
	const { qid, mode } = req.body;

	// Bucket.findOne({ user: ObjectId(id) }).then((bucket) => {

	// });

	User.get(id).then((user) => {
		// TODO: fetch question and add content to bookmark
		let found = -1;
		user.bookmarks.forEach((b, idx) => {
			if (b.qid === qid) {
				found = idx;
			}
		});
		if (found !== -1) {
			user.bookmarks.splice(found, 1);
			user.markModified('bookmarks');
			user.save();
			res.json({ bookmark: false });
		} else if (mode === 'live') {
			Question.get(qid).then((question) => {
				user.bookmarks.push({
					qid,
					sid: user.session.live,
					content: question.content,
					date: new Date(),
					topic: question.topic,
					sub_topic: question.sub_topic,
				});
				user.markModified('bookmarks');
				user.save();
				res.json({ bookmark: true });
			});
		} else if (mode === 'assessment') {
			Attempt.findOne({ user: ObjectId(id), question: ObjectId(qid) }, { _id: 1 })
				.populate([{ path: 'question', select: 'content topic sub_topic' }])
				.then((attempt) => {
					if (attempt) {
						user.bookmarks.push({
							qid,
							content: attempt.question.content,
							date: new Date(),
							topic: attempt.question.topic,
							sub_topic: attempt.question.sub_topic,
						});
						user.markModified('bookmarks');
						user.save();
						res.json({ success: true, bookmark: true });
					} else {
						res.json({ success: false, error: 'attempt not found' });
					}
				});
		} else {
			Session.searchQuestion(user.session.sessions, qid).then((session) => {
				// not tested
				if (session) {
					Question.get(qid).then((question) => {
						// check session
						user.bookmarks.push({
							qid,
							sid: session,
							content: question.content,
							date: new Date(),
							topic: question.topic,
							sub_topic: question.sub_topic,
						});
						user.markModified('bookmarks');
						user.save();
						res.json({ bookmark: true });
					});
				} else {
					res.json({ error: 'session not found' });
				}
			});
		}
	});
}

function bookmarks(req, res) {
	// will be useless in future
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `users${req.url}`,
		params: req.body,
	});
	User.get(req.payload.id).then((user) => {
		res.json(user.bookmarks);
	});
}

function buckets(req, res) {
	const { id } = req.payload;

	Bucket.findOne({ user: ObjectId(id) })
		.populate([{ path: 'buckets.questions', select: 'content topic sub_topic' }])
		.then((bucket) => {
			if (bucket) {
				res.json({
					success: true,
					buckets: bucket.buckets,
					bookmarkedAtByQuestionId: bucket.bookmarkedAtByQuestionId,
				});
			} else {
				// get bookmarks and add to bucket!!!
				User.findOne({ _id: ObjectId(id) }, { bookmarks: 1 })
					.then((user) => {
						if (user) {
							const qids = user.bookmarks.map((bookmark) => ObjectId(bookmark.qid));
							const bucket_ = new Bucket({
								user: ObjectId(id),
								buckets: [
									{
										name: 'Incorrect',
										color: '#ee4c48',
										default: true,
										questions: [],
									},
									{
										name: 'Overtime',
										color: '#f4ce56',
										default: true,
										questions: [],
									},
									{
										name: 'Following',
										color: '#f4a451',
										default: true,
										questions: qids,
									},
								],
							});
							bucket_.save().then((savedBucket) => {
								Bucket.populate(
									savedBucket,
									{
										path: 'buckets.questions',
										select: 'content topic sub_topic',
									},
									(err, savedBucket_) => {
										if (err) {
											res.json({ success: false });
											// handle this
										} else {
											res.json({ success: true, buckets: savedBucket_.buckets });
										}
									}
								);
							});
						} else {
							res.json({ success: false });
						}
						//

						//
					})
					.catch(() => {
						res.json({ success: false });
					});
			}
		});
}

function endDemo(req, res) {
	const { step } = req.params;
	User.get(req.payload.id).then((user) => {
		let newStep = 0;
		if (step === '1') {
			newStep = 2;
		} else if (step === '2') {
			newStep = 3;
		} else if (step === '4') {
			newStep = 2;
		} else if (step === '5') {
			newStep = 0;
		}
		user.demoStep = newStep;
		user.markModified('demoStep');
		user.save().then(() => res.json({ user: secureUser(user) }));
	});
}

function resendVerificationToken(req, res) {
	const { id } = req.payload;
	User.get(id).then((user) => {
		if (user.isVerified) {
			return res.status(400).send({
				msg: 'This account has already been verified. Please log in.',
			});
		}

		const token = new VerificationToken({
			_userId: user._id,
			token: crypto.randomBytes(16).toString('hex'),
		});

		token.save((err) => {
			if (err) {
				return res.status(500).send({ msg: err.message });
			}
			const smtpTransport = nodemailer.createTransport({
				service: 'gmail',
				auth: {
					user: 'support@prepleaf.com',
					pass: 'bing@prepleafX',
				},
			});
			const mailOptions = {
				to: user.email,
				from: 'support@prepleaf.com',
				subject: 'Account Verification Token',
				text:
					`${
						'Dear User\n\n' +
						'You are required to verify email id by clicking below link\n' +
						`${process.env.API_BASE_HOST}${process.env.API_BASE_PATH}/users/confirmation`
					}${token.token}.\n` +
					'If you are unable to login, do write us at support@prepleaf.com.\n\n' +
					'Regards\nPrepleaf',
			};
			smtpTransport.sendMail(mailOptions, () => {
				// res.json({success: true})
			});
			res.json({ success: true });
		});
	});
}

function confirmToken(req, res) {
	const { token } = req.params;
	VerificationToken.get(token).then((t) => {
		if (!t) {
			return res.status(400).send({
				type: 'not-verified',
				msg: 'We were unable to find a valid token. Your token my have expired.',
			});
		}
		// If we found a token, find a matching user
		User.get(t._userId).then((user) => {
			if (!user) {
				return res.status(400).send({
					msg: 'We were unable to find a user for this token.',
				});
			}
			if (user.isVerified) {
				return res.status(400).send({
					type: 'already-verified',
					msg: 'This user has already been verified.',
				});
			}

			// Verify and save the user
			user.isVerified = true;
			user.markModified('isVerified');
			user.save().then(() => {
				res.status(200).send('The account has been verified. Please log in.');
				notifyUser(t._userId, 'email-verification-success', { success: true });
			});
			// user.save(function (err) {
			//     if (err) { return res.status(500).send({ msg: err.message }); }
			//     res.status(200).send("The account has been verified. Please log in.");
			// });
		});
	});
}

function verifyUser(req, res) {
	const {
		payload: { role },
	} = req;
	if (req.body.role === 'admin' && role !== 'super') {
		res
			.status(422)
			.json({ success: false, error: { code: 'auth/email-not-verified' } }); // change this error code
		return;
	}
	const { username } = req.body;
	User.findOne({ username }).then((user) => {
		if (user) {
			user.set('isVerified', true);
			user.save().then(() => {
				res.json({ success: true });
			});
		} else {
			res
				.status(422)
				.json({ success: false, error: { code: 'auth/user-not-found' } }); // change this error code
		}
	});
}

const getXPConfig = (req, res) => {
	res.send({
		minimumBalance: process.env.MINIMUM_XP_BALANCE,
		xpPerRupee: process.env.XP_PER_RUPEE,
	});
};

function resetStats(req, res) {
	if (req.payload.role !== 'super') {
		res.json({ success: false });
		return;
	}
	const nTopics = [
		'5cf24d21907b545e474224ce',
		'5cf3834c76d8c970c20442f5',
		'5cf3835f76d8c970c20442f7',
		'5cf3836d76d8c970c20442f9',
		'5d0bd2cbed364f20f274954c',
		'5d0dab7ded364f20f27495b3',
	];
	User.find({ 'stats.topics.id': { $in: nTopics } })
		.exec()
		.then((users) => {
			// users.forEach((user) => {

			//     user.stats.topics.forEach((topic) => {
			//         if(nTopics.indexOf(topic.id) !== -1) {

			//         }
			//     })
			// });

			res.json({ success: true, count: users.length });
		});
}

function cat(req, res) {
	const supergroup = '5d10e43944c6e111d0a17d0c';
	SubGroupModel.find({ supergroup }).then((groups) => {
		const topics = [];
		groups.forEach((group) => {
			group.topics.forEach((topic) => {
				if (topics.indexOf(topic.topic) === -1) {
					topics.push(topic.topic);
				}
			});
		});

		Topic.findOne({}).then((topicData) => {
			const filteredTopics = [];
			topicData.topics.forEach((topic) => {
				if (topics.indexOf(topic._id.toString()) !== -1) {
					filteredTopics.push({
						_id: topic._id,
						name: topic.name,
						sub_topics: topic.sub_topics.map((st) => ({
							_id: st._id,
							name: st.name,
						})),
					});
				}
			});

			Phase.findOne(
				{ _id: ObjectId('5e008afc6f40c16ebaf27592') },
				{ topicMocks: 1, sectionalMocks: 1, fullMocks: 1, liveTests: 1 }
			).then((phase) => {
				const today = new Date();
				AssessmentWrapper.find(
					{ 'phases.phase': phase._id, visibleFrom: { $lte: today } },
					{
						core: 1,
						name: 1,
						slang: 1,
						type: 1,
						topic: 1,
						section: 1,
						label: 1,
						availableFrom: 1,
						availableTill: 1,
						visibleFrom: 1,
						graded: 1,
						cost: 1,
						reward: 1,
						phase: 1,
						description: 1,
						comps: 1,
						messages: 1,
					}
				)
					.populate([{ path: 'core', select: 'instructions syllabus duration' }])
					.then((assessmentWrappers) => {
						const today = new Date();
						const feeds = { liveAssessments: [] };
						assessmentWrappers.forEach((assessmentWrapper) => {
							if (
								new Date(assessmentWrapper.availableFrom).getTime() > today.getTime()
							) {
							} else if (
								new Date(assessmentWrapper.availableTill).getTime() > today.getTime()
							) {
								feeds.liveAssessments.push({
									name: assessmentWrapper.name,
									id: assessmentWrapper._id,
									duration: assessmentWrapper.core.duration,
									availableFrom: assessmentWrapper.availableFrom,
									supergroup,
								});
							}
						});

						Leaderboard.findOne({ phase: phase._id }, { ratings: 1 })
							.populate([{ path: 'ratings.user', select: '_id username dp' }])
							.then((leaderboard) => {
								const leaderboard_ = [];
								if (leaderboard) {
									leaderboard.ratings.sort((a, b) => {
										if (b.rating > a.rating) return 1;
										return -1;
									});
									leaderboard_.push(...leaderboard.ratings.splice(0, 10));
								}
								res.set('Cache-Control', 'public, s-maxage=86400');
								res.json({
									success: true,
									assessmentWrappers,
									topics: filteredTopics,
									feeds,
									supergroup,
									phase,
									percentComplete: 82,
									leaderboard: leaderboard_,
									category: {
										bluff1: false,
										bluff2: false,
										bluff3: false,
										bluff4: false,
										bluff5: false,
										cAssigned: 3,
										endurance: 77,
										pickingAbility: 37,
										stubborness: 12,
										intent: 92,
										stamina: 69,
										topics: [
											{
												// Quant
												id: '5c9a660e01d3a533d7c16aaf',
												'correct-too-fast': 0,
												'correct-optimum': 9,
												'correct-too-slow': 0,
												'incorrect-too-fast': 0,
												'incorrect-optimum': 2,
												'incorrect-too-slow': 2,
												unattempted: 10,
												subTopics: [
													{
														// Geometry
														id: '5ce27ff5ff96dd1f72ce918a',
														'correct-too-fast': 0,
														'correct-optimum': 4,
														'correct-too-slow': 0,
														'incorrect-too-fast': 0,
														'incorrect-optimum': 0,
														'incorrect-too-slow': 2,
														unattempted: 5,
													},
													{
														// P n C
														id: '5ce27fc8ff96dd1f72ce9136',
														'correct-too-fast': 0,
														'correct-optimum': 4,
														'correct-too-slow': 0,
														'incorrect-too-fast': 0,
														'incorrect-optimum': 0,
														'incorrect-too-slow': 2,
														unattempted: 5,
													},
												],
											},
											{
												// VARC
												id: '5d1f1ba3c144745ffcdcbabf',
												'correct-too-fast': 0,
												'correct-optimum': 8,
												'correct-too-slow': 3,
												'incorrect-too-fast': 1,
												'incorrect-optimum': 10,
												'incorrect-too-slow': 4,
												unattempted: 15,
												subTopics: [
													{
														// Verbal Reasoning
														id: '5d5e63c4eaf5f804d9c7d975',
														'correct-too-fast': 0,
														'correct-optimum': 4,
														'correct-too-slow': 3,
														'incorrect-too-fast': 1,
														'incorrect-optimum': 10,
														'incorrect-too-slow': 2,
														unattempted: 10,
													},
													{
														// Para Jumble / Completion
														id: '5da78b6af0197223284a2783',
														'correct-too-fast': 0,
														'correct-optimum': 4,
														'correct-too-slow': 0,
														'incorrect-too-fast': 0,
														'incorrect-optimum': 0,
														'incorrect-too-slow': 2,
														unattempted: 5,
													},
												],
											},
										],
										totalAssessments: 4,
									},
								});
							});
					});
			});
		});
	});
}

function placement(req, res) {
	const supergroup = '5d10e42744c6e111d0a17d0a';
	SubGroupModel.find({ supergroup }).then((groups) => {
		const topics = [];
		groups.forEach((group) => {
			group.topics.forEach((topic) => {
				if (topics.indexOf(topic.topic) === -1) {
					topics.push(topic.topic);
				}
			});
		});

		Topic.findOne({}).then((topicData) => {
			const filteredTopics = [];
			topicData.topics.forEach((topic) => {
				if (topics.indexOf(topic._id.toString()) !== -1) {
					filteredTopics.push({
						_id: topic._id,
						name: topic.name,
						sub_topics: topic.sub_topics.map((st) => ({
							_id: st._id,
							name: st.name,
						})),
					});
				}
			});

			Phase.findOne(
				{ _id: ObjectId('5e14f21bd7b3d8274ce4be9f') },
				{ topicMocks: 1, sectionalMocks: 1, fullMocks: 1, liveTests: 1 }
			).then((phase) => {
				const today = new Date();
				AssessmentWrapper.find(
					{ 'phases.phase': phase._id, visibleFrom: { $lte: today } },
					{
						core: 1,
						name: 1,
						slang: 1,
						type: 1,
						topic: 1,
						section: 1,
						label: 1,
						availableFrom: 1,
						availableTill: 1,
						visibleFrom: 1,
						graded: 1,
						cost: 1,
						reward: 1,
						phase: 1,
						description: 1,
						comps: 1,
						messages: 1,
						difficulty: 1,
					}
				)
					.populate([{ path: 'core', select: 'instructions syllabus duration' }])
					.then((assessmentWrappers) => {
						const today = new Date();
						const feeds = { liveAssessments: [] };
						assessmentWrappers.forEach((assessmentWrapper) => {
							if (
								new Date(assessmentWrapper.availableFrom).getTime() > today.getTime()
							) {
							} else if (
								new Date(assessmentWrapper.availableTill).getTime() > today.getTime()
							) {
								feeds.liveAssessments.push({
									name: assessmentWrapper.name,
									id: assessmentWrapper._id,
									duration: assessmentWrapper.core.duration,
									availableFrom: assessmentWrapper.availableFrom,
									supergroup,
								});
							}
						});

						Leaderboard.findOne({ phase: phase._id }, { ratings: 1 })
							.populate([{ path: 'ratings.user', select: '_id username dp' }])
							.then((leaderboard) => {
								const leaderboard_ = [];
								if (leaderboard) {
									leaderboard.ratings.sort((a, b) => {
										if (b.rating > a.rating) return 1;
										return -1;
									});
									leaderboard_.push(...leaderboard.ratings.splice(0, 10));
								}
								res.set('Cache-Control', 'public, s-maxage=86400');
								res.json({
									success: true,
									assessmentWrappers,
									topics: filteredTopics,
									feeds,
									supergroup,
									phase,
									percentComplete: 79,
									leaderboard: leaderboard_,
									category: {
										bluff1: false,
										bluff2: false,
										bluff3: false,
										bluff4: false,
										bluff5: false,
										cAssigned: 3,
										endurance: 77,
										pickingAbility: 37,
										stubborness: 12,
										intent: 92,
										stamina: 69,
										topics: [
											{
												// Quant
												id: '5c9a660e01d3a533d7c16aaf',
												'correct-too-fast': 0,
												'correct-optimum': 9,
												'correct-too-slow': 0,
												'incorrect-too-fast': 0,
												'incorrect-optimum': 2,
												'incorrect-too-slow': 2,
												unattempted: 10,
												subTopics: [
													{
														// P n C
														id: '5ce27fc8ff96dd1f72ce9136',
														'correct-too-fast': 0,
														'correct-optimum': 4,
														'correct-too-slow': 0,
														'incorrect-too-fast': 0,
														'incorrect-optimum': 0,
														'incorrect-too-slow': 2,
														unattempted: 5,
													},
													{
														// Time Distance & Work
														id: '5ce27f16ff96dd1f72ce90e2',
														'correct-too-fast': 0,
														'correct-optimum': 4,
														'correct-too-slow': 0,
														'incorrect-too-fast': 0,
														'incorrect-optimum': 0,
														'incorrect-too-slow': 2,
														unattempted: 5,
													},
												],
											},
											{
												// Data Interpretation
												id: '5d5e4c0beaf5f804d9c7d8db',
												'correct-too-fast': 0,
												'correct-optimum': 4,
												'correct-too-slow': 3,
												'incorrect-too-fast': 1,
												'incorrect-optimum': 10,
												'incorrect-too-slow': 2,
												unattempted: 10,
												subTopics: [
													{
														// Charts and Graph
														id: '5da78acdf0197223284a2763',
														'correct-too-fast': 0,
														'correct-optimum': 4,
														'correct-too-slow': 3,
														'incorrect-too-fast': 1,
														'incorrect-optimum': 10,
														'incorrect-too-slow': 2,
														unattempted: 10,
													},
												],
											},
										],
										totalAssessments: 4,
									},
								});
							});
					});
			});
		});
	});
}

function jee(req, res) {
	const supergroup = '5dd95e8097bc204881be3f2c';
	SubGroupModel.find({ supergroup }).then((groups) => {
		const topics = [];
		groups.forEach((group) => {
			group.topics.forEach((topic) => {
				if (topics.indexOf(topic.topic) === -1) {
					topics.push(topic.topic);
				}
			});
		});

		Topic.findOne({}).then((topicData) => {
			const filteredTopics = [];
			topicData.topics.forEach((topic) => {
				if (topics.indexOf(topic._id.toString()) !== -1) {
					filteredTopics.push({
						_id: topic._id,
						name: topic.name,
						sub_topics: topic.sub_topics.map((st) => ({
							_id: st._id,
							name: st.name,
						})),
					});
				}
			});

			Phase.findOne(
				{ _id: '5e0096346f40c16ebaf27714' },
				{ topicMocks: 1, sectionalMocks: 1, fullMocks: 1, liveTests: 1 }
			).then((phase) => {
				const today = new Date();
				AssessmentWrapper.find(
					{ 'phases.phase': phase._id, visibleFrom: { $lte: today } },
					{
						core: 1,
						name: 1,
						slang: 1,
						type: 1,
						topic: 1,
						section: 1,
						label: 1,
						availableFrom: 1,
						availableTill: 1,
						visibleFrom: 1,
						graded: 1,
						cost: 1,
						reward: 1,
						phase: 1,
						description: 1,
						comps: 1,
						messages: 1,
					}
				)
					.populate([{ path: 'core', select: 'instructions syllabus duration' }])
					.then((assessmentWrappers) => {
						const feeds = { liveAssessments: [] };
						assessmentWrappers.forEach((assessmentWrapper) => {
							if (
								new Date(assessmentWrapper.availableFrom).getTime() > today.getTime()
							) {
							} else if (
								new Date(assessmentWrapper.availableTill).getTime() > today.getTime()
							) {
								feeds.liveAssessments.push({
									name: assessmentWrapper.name,
									id: assessmentWrapper._id,
									duration: assessmentWrapper.core.duration,
									availableFrom: assessmentWrapper.availableFrom,
									supergroup,
								});
							}
						});

						Leaderboard.findOne({ phase: phase._id }, { ratings: 1 })
							.populate([{ path: 'ratings.user', select: '_id username dp' }])
							.then((leaderboard) => {
								const leaderboard_ = [];
								if (leaderboard) {
									leaderboard.ratings.sort((a, b) => {
										if (b.rating > a.rating) return 1;
										return -1;
									});
									leaderboard_.push(...leaderboard.ratings.splice(0, 10));
								}

								res.set('Cache-Control', 'public, s-maxage=86400');
								res.json({
									success: true,
									assessmentWrappers,
									topics: filteredTopics,
									feeds,
									supergroup,
									phase,
									percentComplete: 63,
									leaderboard: leaderboard_,
									category: {
										bluff1: false,
										bluff2: false,
										bluff3: false,
										bluff4: false,
										bluff5: false,
										cAssigned: 3,
										endurance: 77,
										pickingAbility: 37,
										stubborness: 12,
										intent: 92,
										stamina: 69,
										topics: [
											{
												// Integral Calculus
												id: '5d641e2b2e8a7c5406d4448d',
												'correct-too-fast': 0,
												'correct-optimum': 9,
												'correct-too-slow': 0,
												'incorrect-too-fast': 0,
												'incorrect-optimum': 2,
												'incorrect-too-slow': 2,
												unattempted: 10,
												subTopics: [
													{
														// Indefinite Integration
														id: '5d6426ce2e8a7c5406d4453a',
														'correct-too-fast': 0,
														'correct-optimum': 4,
														'correct-too-slow': 0,
														'incorrect-too-fast': 0,
														'incorrect-optimum': 0,
														'incorrect-too-slow': 2,
														unattempted: 5,
													},
													{
														// Definite Integration
														id: '5d6426c62e8a7c5406d44539',
														'correct-too-fast': 0,
														'correct-optimum': 4,
														'correct-too-slow': 0,
														'incorrect-too-fast': 0,
														'incorrect-optimum': 0,
														'incorrect-too-slow': 2,
														unattempted: 5,
													},
												],
											},
											{
												// Electricity and Magnetism
												id: '5d641d8f2e8a7c5406d44478',
												'correct-too-fast': 0,
												'correct-optimum': 8,
												'correct-too-slow': 3,
												'incorrect-too-fast': 1,
												'incorrect-optimum': 10,
												'incorrect-too-slow': 4,
												unattempted: 15,
												subTopics: [
													{
														// EMF
														id: '5d6421c92e8a7c5406d444b7',
														'correct-too-fast': 0,
														'correct-optimum': 4,
														'correct-too-slow': 3,
														'incorrect-too-fast': 1,
														'incorrect-optimum': 10,
														'incorrect-too-slow': 2,
														unattempted: 10,
													},
													{
														// Capacitance
														id: '5d6421da2e8a7c5406d444b8',
														'correct-too-fast': 0,
														'correct-optimum': 4,
														'correct-too-slow': 0,
														'incorrect-too-fast': 0,
														'incorrect-optimum': 0,
														'incorrect-too-slow': 2,
														unattempted: 5,
													},
												],
											},
										],
										totalAssessments: 10,
									},
								});
							});
					});
			});
		});
	});
}

const migrateBatch = () =>
	new Promise((resolve) => {
		User.find({ emailIdentifier: { $regex: /\.[\w+.]+@/g } })
			.select('email emailIdentifier')
			.limit(1000)
			.exec((error, users) => {
				async.parallel(
					users.map((user) => (cb) => {
						user.set('emailIdentifier', getStrippedEmail(user.email));
						user.save((e) => {
							if (e) {
								cb(null, { error: e, value: user });
							} else {
								cb(null, {});
							}
						});
					}),
					(_error, results) => {
						const errors = [];
						let successCount = 0;
						results.forEach((r) => {
							if (r.error) {
								errors.push({
									error: r.error.message,
									email: r.value.email,
								});
							} else {
								successCount += 1;
							}
						});
						resolve({ successCount, errors });
					}
				);
			});
	});

const migrateEmailAddress = (req, res) => {
	User.count({ emailIdentifier: { $regex: /\.[\w+.]+@/g } }).then(
		(error, numberOfUsersWithoutEmailIdentifier) => {
			migrateBatch(100).then((r) => {
				res.send({ totalBeforeFix: numberOfUsersWithoutEmailIdentifier, r });
			});
		}
	);
};

function migrateStats(req, res) {
	PreAnalysis.find({}).then((pas) => {
		pas.forEach((pa) => {
			pa.stats.sections.forEach((section) => {
				let sectionTime = 0;
				section.questions.forEach((question) => {
					//
					const time = question.correctAttempts
						? question.sumTime / question.correctAttempts
						: 0;
					sectionTime += time;
					question.times = [];
					for (let i = 0; i < question.correctAttempts; i++) {
						question.times.push(time);
					}
				});
				for (let i = 0; i < 30; i++) {
					section.times.push(sectionTime);
				}
			});
			pa.markModified('stats');
			pa.save();
		});
		res.json({});
	});
}

const getSubscribedTopics = (req, res) => {
	// only used in mobile app
	const projection = {
		username: 1,
		name: 1,
		mobileNumber: 1,
		email: 1,
		isVerified: 1,
		session: 1,
		liveAssessment: 1,
		notes: 1,
		stats: 1,
		xp: 1,
		streak: 1,
		netXp: 1,
		milestones: 1,
		settings: 1,
		dp: 1,
		thumbnail: 1,
		role: 1,
		type: 1,
		demoStep: 1,
		subscriptions: 1,
		category: 1,
	};

	const handleError = (error, options) => {
		const { errorCode, status } = options || {};
		if (error && error.message) {
			res.status(status || 500).send({ errorCode, error });
		} else {
			res.status(500).send({ message: 'Internal server error' });
		}
	};
	const transformSubTopics = (subTopics) =>
		subTopics.filter((subTopic) => !subTopic.hide);

	const transformTopics = (topics) =>
		topics
			.map((topic) => {
				if (
					!topic.difficulty ||
					(!topic.difficulty.Easy && !topic.difficulty.Hard && !topic.Medium) ||
					!topic.sub_topics
				) {
					return null;
				}
				return {
					name: topic.name,
					_id: topic._id,
					percent_complete: topic.percent_complete,
					sub_topics: transformSubTopics(topic.sub_topics),
				};
			})
			.filter((topic) => !!topic);

	User.get(req.payload.id, projection)
		.then((user) => {
			userTopics(user)
				.then((topicData) => {
					res.send({
						topics: transformTopics(topicData.topics),
					});
				})
				.catch(handleError);
		})
		.catch(handleError);
};

const updatePhase = (req, res) => {
	const { subgroup, phase } = req.body;
	Phase.findOne({
		_id: ObjectId(phase),
		'subgroups.subgroup': ObjectId(subgroup),
	})
		.then((phase1) => {
			if (phase1) {
				User.get(req.payload.id, { subscriptions: 1 })
					.then((user) => {
						user.subscriptions.forEach((subscription) => {
							subscription.subgroups.forEach((subgroup_) => {
								if (subgroup_.group === subgroup) {
									let found = -1;
									subgroup_.phases.forEach((phase2, idx) => {
										if (phase2.phase.toString() == phase) {
											found = idx;
											phase2.active = true;
										} else {
											phase2.active = false;
										}
									});
									if (found === -1) {
										subgroup_.phases.push({
											phase: phase1._id,
											active: true,
											isAccessGranted: true,
										});
									}
								}
							});
						});
						user.markModified('subscriptions');
						user.save().then(() => {
							UserCache.del(user._id);
							res.json({ success: true });
						});
					})
					.catch(() => {
						res.json({ success: false });
					});
			} else {
				res.json({ success: false });
			}
		})
		.catch(() => {
			res.json({ success: false });
		});
};

function parseQuestionMeta(question) {
	const { time, correct } = question;

	const addToCorrect = correct === 1 ? 1 : 0;
	const addToIncorrect = correct === 0 ? 1 : 0;
	const addToUnattempted = correct === -1 ? 1 : 0;
	const addToCorrectTime = correct === 1 ? time : 0;
	const addToIncorrectTime = correct === 0 ? time : 0;
	const addToUnattemptedTime = correct === -1 ? time : 0;

	return {
		addToCorrect,
		addToIncorrect,
		addToUnattempted,
		addToCorrectTime,
		addToIncorrectTime,
		addToUnattemptedTime,
	};
}

const fixStats = (req, res) => {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}
	let ii = 0;

	// db.users.find({
	// 	'stats.topics.0': { $exists: true },
	// 	'stats.topics.id': { $exists: false },
	// });

	User.find(
		{
			// version: { $ne: 4 },
			'stats.topics.0': { $exists: true },
			'stats.topics.id': { $exists: false },
			// _id: ObjectId('5e1daa32591b054ddc6d4ea1'),
		},
		{ stats: 1 }
	)
		.limit(6)
		.then((users) => {
			users.forEach((user) => {
				Submission.find({ user: user._id, graded: true })
					.populate([
						{
							path: 'assessmentCore',
							populate: [{ path: 'sections.questions.question' }],
						},
					])
					.then((submissions) => {
						console.log('submissions found', submissions.length);
						const topics = [];
						submissions.forEach((submission) => {
							//
							const metaSecs = submission.meta.sections;
							const coreSecs = submission.assessmentCore.sections;
							const wId = submission.assessmentWrapper;
							metaSecs.forEach((sec, secIndex) => {
								sec.questions.forEach((que, queIndex) => {
									const { topic } = coreSecs[secIndex].questions[queIndex].question;
									const { sub_topic } = coreSecs[secIndex].questions[queIndex].question;
									const {
										addToCorrect,
										addToUnattempted,
										addToIncorrect,
										addToCorrectTime,
										addToIncorrectTime,
										addToUnattemptedTime,
									} = parseQuestionMeta(que);

									let t = getTopicIndex(topics, topic);
									if (t === null) {
										topics.push({
											id: topic,
											percent_complete: 0,
											last_activity: {},
											test_performance: {},
											sub_topics: [
												{
													id: sub_topic,
													percent_complete: 0,
													last_activity: {},
													questions: [],
													test_performance: {},
												},
											],
										});
										t = topics.length - 1;
									}
									let st = getTopicIndex(topics[t].sub_topics, sub_topic);
									if (st === null) {
										topics[t].sub_topics.push({
											id: sub_topic,
											percent_complete: 0,
											last_activity: {},
											questions: [],
											test_performance: {},
										});
										st = topics[t].sub_topics.length - 1;
									}

									let old = topics[t].test_performance[wId];
									if (old && old.precision != null && old.count != null) {
										topics[t].test_performance[wId].precision += addToCorrect;
										topics[t].test_performance[wId].count += 1;
										topics[t].test_performance[wId].correct += addToCorrect;
										topics[t].test_performance[wId].incorrect += addToIncorrect;
										topics[t].test_performance[wId].unattempted += addToUnattempted;
										topics[t].test_performance[wId].correctTime += addToCorrectTime;
										topics[t].test_performance[wId].incorrectTime += addToIncorrectTime;
										topics[t].test_performance[wId].unattemptedTime +=
											addToUnattemptedTime;
									} else {
										topics[t].test_performance[wId] = {
											precision: addToCorrect,
											count: 1,
											correct: addToCorrect,
											incorrect: addToIncorrect,
											unattempted: addToUnattempted,
											correctTime: addToCorrectTime,
											incorrectTime: addToIncorrectTime,
											unattemptedTime: addToUnattemptedTime,
										};
									}
									old = topics[t].sub_topics[st].test_performance[wId];
									if (old && old.precision != null && old.count != null) {
										topics[t].sub_topics[st].test_performance[wId].precision +=
											addToCorrect;
										topics[t].sub_topics[st].test_performance[wId].count += 1;
										topics[t].sub_topics[st].test_performance[wId].correct +=
											addToCorrect;
										topics[t].sub_topics[st].test_performance[wId].incorrect +=
											addToIncorrect;
										topics[t].sub_topics[st].test_performance[wId].unattempted +=
											addToUnattempted;
										topics[t].sub_topics[st].test_performance[wId].correctTime +=
											addToCorrectTime;
										topics[t].sub_topics[st].test_performance[wId].incorrectTime +=
											addToIncorrectTime;
										topics[t].sub_topics[st].test_performance[wId].unattemptedTime +=
											addToUnattemptedTime;
									} else {
										topics[t].sub_topics[st].test_performance[wId] = {
											precision: addToCorrect,
											count: 1,
											correct: addToCorrect,
											incorrect: addToIncorrect,
											unattempted: addToUnattempted,
											correctTime: addToCorrectTime,
											incorrectTime: addToIncorrectTime,
											unattemptedTime: !addToUnattemptedTime,
										};
									}
								});
							});

							//
						});
						user.stats.topics = topics;
						user.version = 4;
						user.markModified('stats.topics');
						user.markModified('version');
						user.save().then(() => {
							if (ii % 5 === 0) {
								console.log('completed', ii + 1, 'users');
							}
							ii += 1;
						});
						// console.log('check final topics', topics);
					});
			});
		});
	res.json({ success: true });
};

const sendInvitation = (req, res) => {
	const {
		payload: { id },
		body: { email, referralLink },
	} = req;

	User.findById(id)
		.then((user) => {
			if (user) {
				let message = `Hi,\n\n${user.name} (${user.email}) has invited you to join Prepleaf.\n\n`;
				message +=
					'Please click on the link below to signup and complete the invitation.\n\n';
				message += `${referralLink}\n\n`;
				message += 'Regards,\n';
				message += 'Prepleaf';

				const smtpTransport = nodemailer.createTransport({
					service: 'gmail',
					auth: {
						user: 'support@prepleaf.com',
						pass: 'bing@prepleafX',
					},
				});
				const mailOptions = {
					to: email,
					from: 'Prepleaf',
					subject: 'Invitation to join Prepleaf',
					text: message,
				};
				smtpTransport.sendMail(mailOptions, () => {
					//
				});
				res.json({ success: true });
			} else {
				res.json({ success: false });
			}
		})
		.catch(() => {
			res.json({ success: false });
		});
};

function unsubscribe(req, res) {
	const { code } = req.params;
	if (code && code.length === 48) {
		const user = code.substr(0, 24);
		const userxp = code.substr(24, 24);

		User.findOne({ _id: ObjectId(user), 'netXp.xp': ObjectId(userxp) })
			.then((u) => {
				if (u) {
					Unsubscribed.findOne({ user: u._id })
						.then((e) => {
							if (e) {
								res.json({ success: true });
							} else {
								const ee = new Unsubscribed({ user: u._id });
								ee
									.save()
									.then(() => {
										res.json({ success: true });
									})
									.catch(() => {
										res.json({ success: false });
									});
							}
						})
						.catch(() => {
							res.json({ success: false });
						});
				} else {
					res.json({ success: false });
				}
			})
			.catch(() => {
				res.json({ success: false });
			});
	} else {
		res.json({ success: false });
	}
}

module.exports = {
	get,
	getSubscribedTopics,
	list,
	others,
	assignCollege,
	updateGoal,
	updateAccount,
	bookmark,
	bookmarks,
	buckets,
	completeProfile,
	signin,
	addAccount,
	signinGoogle,
	signup,
	signout,
	updatePassword,
	forgotPassword,
	resetPassword,
	support,
	endDemo,
	resendVerificationToken,
	confirmToken,
	verifyUser,
	getXPConfig,
	resetStats,
	cat,
	placement,
	jee,
	migrateEmailAddress,
	migrateStats,
	updatePhase,
	fixStats,
	sendInvitation,
	unsubscribe,
	logoutOfOtherDevices,
};
