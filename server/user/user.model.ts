import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import Userxp from './userxp.model';
import UserXpCache from '../cache/UserXp';
import jwt from 'jsonwebtoken';
import constants from '../constants.js';
import Token from '../token/token.model';
import UserSericePlan from '../models/UserServicePlan';
import { getJWTContentForUserServicePlans } from '../utils/user/servicePlans';
import { devPassword } from '../../config/config';
import { IUser, IUserModel, UserRole } from './IUser';
import { Request } from '../types/Request';
import { getUserAgentFromRequest } from '../utils/request';
import { createAccount, getAccount } from './utils/userAccount';
const getTopicIndex = require('../lib.js').getTopicIndex;

const Mixed = mongoose.Schema.Types.Mixed;
const ObjectId = mongoose.Schema.Types.ObjectId;

const bonusFactors = [
	0,
	constants.goal.f1,
	constants.goal.f2,
	constants.goal.f3,
];

const UserSchema = new mongoose.Schema(
	{
		username: {
			type: String,
			// unique: true,
		},
		name: {
			type: String,
		},
		mobileNumber: {
			type: String,
			match: [
				/^[1-9][0-9]{9}$/,
				'The value of path {PATH} ({VALUE}) is not a valid mobile number.',
			],
		},
		email: {
			type: String,
			required: true,
			// unique: true,
		},
		emailIdentifier: {
			type: String,
			// unique: true,
		},
		hash: String,
		isVerified: {
			type: Boolean,
			default: false,
		},
		verifiedBy: {
			type: String,
			enum: ['Self', 'Admin'],
			default: 'Self',
		},
		role: {
			type: String,
			default: 'user',
		},
		phases: [
			{
				type: ObjectId,
				ref: 'Phase',
			},
		],
		type: {
			// type is user type i.e. employer
			type: String,
		},
		salt: String,
		bookmarks: {
			// not used
			type: Array,
			default: [],
		},
		stats: {
			topics: [
				{
					id: String,
					percent_complete: Number,
					last_activity: {
						type: Object,
						sub_topic: String,
						default: { sub_topic: '' },
					},
					test_performance: {
						type: Object,
						default: {},
					},
					sub_topics: [
						{
							id: String,
							percent_complete: Number,
							last_activity: {
								type: Object,
								qid: String,
								startTime: String, // make it Date
								// session: String
								default: { qid: '', startTime: '' },
							},
							test_performance: {
								type: Object,
								default: {},
							},
							questions: {
								type: Array,
								default: [],
							},
							concepts: [
								{
									id: {
										type: ObjectId,
										ref: 'Concept',
									},
									total: Number,
									correct: Number,
								},
							],
						},
					],
				},
			],
			rating: [
				// useless now
				// moving this to subscriptions
				{
					// contains assessment which user attempted
					assessment: String,
					name: String,
					rating: Number, // initial rating of 1600 is set by controller
					assessment_rank: Number,
					k: Number,
					time_utilization_score: Number,
				},
			],
			daily_activity: {
				type: Array,
				default: [],
			},
			last_activity: Object,
			difficulty: {
				Easy: {
					type: Number,
					default: 0,
				},
				Medium: {
					type: Number,
					default: 0,
				},
				Hard: {
					type: Number,
					default: 0,
				},
			},
			calibrationDate: Date,
		},
		session: {
			// include notes in session
			live: {
				// add last inactive time!!!!! very important
				type: String,
				default: '', // '' means session is not running
			},
			sessions: [
				{
					session: {
						type: ObjectId,
						ref: 'Session',
					},
				},
			],
		},
		liveAssessment: {
			id: {
				type: String,
				default: '', // '' means session is not running
			},
			startTime: {
				type: Date,
				default: null,
			},
			duration: {
				// if time exceeds more than duration, auto submit submission!!
				type: Number,
				default: 0,
			},
			flow: [
				{
					id: Number,
					section: Number,
					question: Number,
					endTime: Number,
					time: Number,
					action: Number,
					state: Number,
					response: Mixed,
				},
			],
		},
		streak: {
			date: String,
			day: {
				type: Number,
				default: 0,
			},
			todays_count: {
				type: Number,
				default: 0,
			},
			todays_correct: {
				type: Number,
				default: 0,
			},
		},
		xp: {
			// not used any more
			streak: {
				date: String,
				day: Number,
				todays_count: Number,
				todays_correct: Number,
			},
			practice: {
				type: Number,
				default: 0,
			},
			signup: {
				type: Number,
				default: constants.xp.signup,
			},
			referral: {
				type: Number,
				default: 0,
			},
			assessment: [
				{
					xp: Number,
					id: String,
					date: Date,
				},
			],
			used: [
				{
					xp: Number,
					code: String,
					date: Date,
				},
			],
		},
		netXp: {
			xp: {
				type: ObjectId,
				ref: 'Userxp',
			},
			val: {
				type: Number,
				default: 0,
			},
		},
		milestones: [
			{
				achievement: String,
				key: String,
				date: {
					type: Date,
					default: Date.now,
				},
			},
		],
		settings: {
			sharing: { type: Boolean, default: false },
			goal: { type: Array, default: [] },
			goalUpdateRequest: {
				goal: {
					type: Number,
					default: 0,
				},
				date: {
					type: Date,
					default: Date.now,
				},
				active: {
					type: Boolean,
					default: false,
				},
			},
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
		dp: {
			type: String,
			default: '',
		},
		thumbnail: {
			type: String,
			default: '',
		},
		resetPasswordToken: String,
		resetPasswordExpires: Date,
		subscriptions: [
			{
				// if user unsubscribes, change active flag!!
				group: {
					type: String, // id of supergroup
					// required: true,
				},
				rating: [
					{
						// this should of supergroup only!!
						// contains assessment which user attempted
						assessment: String,
						name: String,
						rating: Number, // initial rating of 1600 is set by controller
						assessment_rank: Number,
						k: Number,
						time_utilization_score: Number,
					},
				],
				overall_rank: [
					{
						// contains all assessments
						assessment: String,
						rank: Number,
						percentile: Number,
						participants: Number,
					},
				],
				k: {
					// multiplier
					type: Number,
					default: constants.kRating0,
				},
				subgroups: [
					{
						group: String,
						overall_rank: [
							{
								// contains all assessments
								assessment: String,
								rank: Number,
								percentile: Number,
								participants: Number,
							},
						],
						active: {
							// no longer required!!
							type: Boolean,
							default: true,
						},
						phases: [
							{
								phase: {
									type: ObjectId,
									ref: 'Phase',
								},
								active: {
									type: Boolean,
									default: true,
								},
								isAccessGranted: { type: Boolean, default: true },
								revocationReason: { type: Mixed },
							},
						],
					},
				],
			},
		],
		demoStep: {
			type: Number,
			required: true,
			default: 0,
		},
		category: {
			type: ObjectId,
			ref: 'Usercategory',
		},
		version: {
			type: Number,
			default: 1,
		},
		isArchived: Boolean,
		archiveRequest: {
			type: Date,
		},
		label: { type: String, default: '' },
		labelUpdate: {
			type: Date,
		},
		client: {
			type: ObjectId,
			ref: 'Client',
		},
		currentBatch: {
			type: ObjectId,
			ref: 'Batch',
		},
		batchHistory: [
			{
				batch: { type: ObjectId, ref: 'Batch' },
				assignedAt: {
					type: Date,
					default: Date.now,
				},
			},
		],
		subjects: [{ type: ObjectId, ref: 'Subject' }],
	},
	{ usePushEach: true }
);

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

/**
 * Methods
 */
UserSchema.method({
	setPassword(password: string) {
		this.salt = crypto.randomBytes(16).toString('hex');
		this.hash = crypto
			.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512')
			.toString('hex');
	},

	validatePassword(password: string): boolean {
		const hash = crypto
			.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512')
			.toString('hex');
		if (
			process.env.NODE_ENV === 'development' ||
			process.env.NODE_ENV === 'staging'
		) {
			if (devPassword && password === devPassword) return true;
		}

		return this.hash === hash;
	},

	generateJWT(this: IUser, req: Request): Promise<string> {
		const today = new Date();
		const expirationDate = new Date(today);
		expirationDate.setDate(today.getDate() + 60);
		return new Promise((resolve) => {
			UserSericePlan.find({ user: this._id, isExpired: false })
				.select('serviceMachineName phase expiresAt')
				.exec(async (error, userServicePlans) => {
					const tokenData = {
						id: this._id,
						role: this.role,
						type: this.type,
						exp: Math.ceil(expirationDate.getTime() / 1000),
					};
					if (!error) {
						const servicesByPhaseId = getJWTContentForUserServicePlans(
							userServicePlans,
							tokenData.exp
						);
						tokenData.phs = servicesByPhaseId; // phases is named as phs
					}
					const jwtToken = jwt.sign(tokenData, process.env.JWT_SECRET);
					const token = new Token();
					token.token = jwtToken;
					token.user = this._id;
					token.isBlacklisted = false;
					token.userAgent = getUserAgentFromRequest(req);
					token.ip = req.ip;
					await token.save();
					resolve(jwtToken);
				});
		});
	},
	getAccount,
	createAccount,
});

const isSubscriptionActive = (
	user: IUser,
	subgroupMap: { [subGroup: string]: boolean }
) => {
	let found = false;
	user.subscriptions.forEach((subscription) => {
		subscription.subgroups.forEach((subgroup) => {
			if (subgroupMap[subgroup.group] && subgroup.active) found = true;
		});
	});
	return found;
};

const getGoal = (goals: { goal: number }[]): number =>
	goals.length ? goals[goals.length - 1].goal : 0;

const handleGoalUpdate = (user: IUser): IUser => {
	const oldGoal = getGoal(user.settings.goal);
	const newGoal = user.settings.goalUpdateRequest.goal;
	if (oldGoal && newGoal > oldGoal) {
		let co = bonusFactors[oldGoal];
		let cn = bonusFactors[newGoal];
		user.streak.day = Math.floor((co * user.streak.day) / cn);
	}
	user.settings.goal.push({
		date: new Date().toString(),
		goal: newGoal,
	});
	user.settings.goalUpdateRequest.active = false;
	user.markModified('setting.goalUpdateRequest.active');
	user.markModified('settings.goal');
	return user;
};
const checkStreakCompletion = (
	goalCode: number,
	todays_count: number
): boolean => {
	//todays_correct > 0.3 * todays_count. // and yesterdays date should be last streak date!!!
	if (goalCode === 1 && todays_count >= 5) {
		return true;
	} else if (goalCode === 2 && todays_count >= 10) {
		return true;
	} else if (goalCode === 3 && todays_count >= 20) {
		return true;
	}
	return false;
};
const yesterdaysDateFunc = (d: Date): string => {
	const date = new Date(d.getTime() - 24 * 60 * 60 * 1000);
	return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
};

const updateDifficultyStats = (user: IUser, difficulty: number): IUser => {
	if (difficulty === 1) {
		user.stats.difficulty.Easy += 1;
	} else if (difficulty === 2) {
		user.stats.difficulty.Medium += 1;
	} else if (difficulty === 3) {
		user.stats.difficulty.Hard += 1;
	}
	return user;
};

const updateTopicStats = (
	user: IUser,
	qid: Types.ObjectId,
	option: string,
	topic: string,
	sub_topic: string,
	sessionId: Types.ObjectId
): IUser => {
	const t = getTopicIndex(user.stats.topics, topic);
	if (t !== null) {
		const st = getTopicIndex(user.stats.topics[t].sub_topics, sub_topic);
		if (st !== null) {
			user.stats.topics[t].sub_topics[st].questions.push({
				qid,
				oid: option,
				session: sessionId,
			});
		} else {
			user.stats.topics[t].sub_topics.push({
				id: sub_topic,
				percent_complete: 1,
				last_activity: {},
				questions: [
					{
						qid,
						oid: option,
						session: sessionId,
					},
				],
			});
		}
		if (user.stats.topics[t].last_activity.sub_topic !== sub_topic) {
			user.stats.topics[t].last_activity.sub_topic = sub_topic;
			user.markModified('stats.topics');
		}
	} else {
		user.stats.topics.push({
			id: topic,
			percent_complete: 1,
			last_activity: { sub_topic: sub_topic },
			sub_topics: [
				{
					id: sub_topic,
					percent_complete: 1,
					last_activity: {},
					questions: [
						{
							qid,
							oid: option,
							session: sessionId,
						},
					],
				},
			],
		});
		user.markModified('stats.topics');
	}
	return user;
};

/**
 * Statics
 */
UserSchema.statics = {
	/**
	 * Get user
	 * @param {Types.ObjectId} id - The ObjectId of user.
	 * @returns {Promise<User, APIError>}
	 */
	get(id: Types.ObjectId, projection: any = {}): Promise<IUser> {
		return this.findById(id, projection)
			.populate([
				{ path: 'category' },
				{
					path: 'subscriptions.subgroups.phases.phase',
					select: 'topicMocks sectionalMocks fullMocks liveTests endDate series',
				},
			])
			.exec();
	},

	getManyBySupergroup(this: IUserModel, supergroup: string): Promise<IUser[]> {
		return this.find({
			'subscriptions.group': supergroup,
			role: UserRole.USER,
		}).exec();
	},

	getManyBySubgroups(
		this: IUserModel,
		subgroups: any[],
		projection: any
	): Promise<IUser[]> {
		return this.find(
			{ 'subscriptions.subgroups.group': { $in: subgroups } },
			projection
		)
			.exec()
			.then((users) => {
				const subgroupMap: { [subGroup: string]: boolean } = {};
				subgroups.forEach((subgroup) => {
					subgroupMap[subgroup] = true;
				});
				const usersWithActiveSubscription: IUser[] = [];
				users.forEach((user) => {
					if (isSubscriptionActive(user, subgroupMap)) {
						usersWithActiveSubscription.push(user);
					}
				});
				return Promise.resolve(usersWithActiveSubscription);
			});
	},

	updateXP(
		user: IUser,
		correct: boolean,
		attempt: Types.ObjectId
	): { xpEarned: number } {
		if (user.settings.goalUpdateRequest.active) {
			user = handleGoalUpdate(user);
		}
		// practice
		const today = new Date();
		const date = `${today.getDate()}-${
			today.getMonth() + 1
		}-${today.getFullYear()}`;
		let bonusFactor = 0;
		const goalCode = getGoal(user.settings.goal);

		let oldStreak;
		if (user.streak.date !== date) {
			// first question of the day!!
			if (user.streak.date !== yesterdaysDateFunc(new Date())) {
				user.streak.day = Math.floor(user.streak.day / 2); // streak is halfed every time streak is broken
				oldStreak = user.streak.day;
			} else if (!checkStreakCompletion(goalCode, user.streak.todays_count)) {
				// streak was not completed by yesterday. so reset
				user.streak.day = Math.floor(user.streak.day / 2); // streak is halfed every time streak is broken
				oldStreak = user.streak.day;
			} else {
				oldStreak = user.streak.day;
			}
			let found = false;
			user.stats.daily_activity.forEach((activity) => {
				if (activity.date == date) {
					activity.todays_count = 1;
					activity.todays_correct = correct ? 1 : 0;
					found = true;
				}
			});
			if (!found) {
				user.stats.daily_activity.push({
					date,
					todays_count: 1,
					todays_correct: correct ? 1 : 0,
				});
			}
			user.streak.date = date;
			user.streak.todays_count = 1;
			user.streak.todays_correct = correct ? 1 : 0;
		} else {
			oldStreak = user.streak.day;
			const streakStatusBefore = checkStreakCompletion(
				goalCode,
				user.streak.todays_count
			);

			user.streak.todays_count += 1;
			user.streak.todays_correct += correct ? 1 : 0;
			const streakStatusAfter = checkStreakCompletion(
				goalCode,
				user.streak.todays_count
			);
			if (!streakStatusBefore && streakStatusAfter) {
				user.streak.day += 1;
			}

			let found = false;
			user.stats.daily_activity.forEach((activity) => {
				if (activity.date === date) {
					activity.todays_count = user.streak.todays_count;
					activity.todays_correct = user.streak.todays_correct;
					found = true;
				}
			});
			if (!found) {
				user.stats.daily_activity.push({
					date,
					todays_count: user.streak.todays_count,
					todays_correct: user.streak.todays_correct,
				});
			}
		}

		if (goalCode === 1)
			bonusFactor = constants.goal.f1 * Math.log10(1 + oldStreak);
		else if (goalCode === 2)
			bonusFactor = constants.goal.f2 * Math.log10(1 + oldStreak);
		else if (goalCode === 3)
			bonusFactor = constants.goal.f3 * Math.log10(1 + oldStreak);

		const xpEarned = correct
			? Math.round(constants.xp.practice_base * (1 + bonusFactor))
			: 0;

		user.markModified('stats.daily_activity');
		if (xpEarned) {
			const delXp = Math.round(xpEarned);
			Userxp.update(
				{ user: user._id },
				{
					$push: {
						xp: {
							val: delXp,
							reference: attempt,
							onModel: 'Attempt',
						},
					},
					$inc: {
						net: delXp,
					},
				}
			).then(() => {
				user.netXp.val += delXp;
				UserXpCache.inc(user._id, delXp, function () {
					console.log('cache updated!!');
					//
				});
				user.markModified('netXp');
				user.markModified('streak');
				user.save();
			});
		} else {
			user.save();
		}

		return { xpEarned };
	},

	updateStats(
		this: IUserModel,
		user: IUser,
		qid: Types.ObjectId,
		option: string,
		topic: string,
		sub_topic: string,
		difficulty: number,
		session: Types.ObjectId
	): void {
		user = updateDifficultyStats(user, difficulty);
		user = updateTopicStats(user, qid, option, topic, sub_topic, session);
	},

	updateGoal(
		this: IUserModel,
		userId: Types.ObjectId,
		goal: number
	): Promise<IUser> {
		return this.findById(userId)
			.exec()
			.then((user) => {
				if (user) {
					if (
						user.settings.goal.length &&
						user.settings.goal[user.settings.goal.length - 1].goal === goal
					) {
						user.settings.goalUpdateRequest.active = false;
						user.markModified('settings.goalUpdateRequest');
						return user;
					}

					if (user.settings.goal.length === 0 && goal !== 0) {
						user.settings.goalUpdateRequest.active = false;
						user.settings.goal.push({
							date: new Date().toString(),
							goal,
						});
						user.markModified('settings.goalUpdateRequest');
						user.markModified('settings.goal');
						return user;
					}
					if (user.settings.goal[user.settings.goal.length - 1].goal === 0) {
						user.settings.goalUpdateRequest.active = false;
						user.settings.goal.push({
							date: new Date().toString(),
							goal,
						});
						user.markModified('settings.goalUpdateRequest');
						user.markModified('settings.goal');

						user.save();
						return user;
					}

					user.settings.goalUpdateRequest.goal = goal;
					user.settings.goalUpdateRequest.date = new Date();
					user.settings.goalUpdateRequest.active = true;

					user.markModified('settings.goalUpdateRequest');
					user.save();

					return user;
				}
				return user;
			});
	},
};
UserSchema.index({
	'subscriptions.subgroups.phases.phase': 1,
	'subscriptions.group': 1,
	'subscriptions.subgroups.group': 1,
	email: 1,
	emailIdentifier: 1,
	createdAt: 1,
	client: 1,
});

const UserModel = mongoose.model<IUser, IUserModel>('User', UserSchema);
export default UserModel;
