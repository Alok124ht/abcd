import { Schema, Types, model, MongooseFilterQuery } from 'mongoose';
import { waterfall } from 'async';
import { batch as _batch, initialQuestionRatingMedium } from '../constants';
import {
	Content,
	IQuestion,
	QuestionModel,
	QuestionOption,
	QuestionAnswerRange,
} from './IQuestion';
import { QuestionType, QuestionTypes } from './QuestionType';
import { QuerySelector } from 'mongodb';
import { isTypeTransitionPossible } from './util/typeTransition';

const { ObjectId, Mixed } = Schema.Types;

const QuestionSchema = new Schema(
	{
		randomId: {
			// randomId can be common
			type: Number,
			// required: true,
			default: 0,
		},
		category: {
			// Conceptual, Calculation, Tricky, Formula
			type: String,
			default: '',
		},
		content: {
			type: Object,
		},
		answers: [
			{
				/* for integer, it will be an integer answer
				 * for Single Correct it will be an option id
				 * for Multiple Correct it will be an array of option ids
				 */
				type: Mixed,
			},
		],
		options: [
			{
				isCorrect: {
					type: Boolean,
				},
				isAlternateCorrect: {
					type: Boolean,
					default: false,
				},
				content: {
					type: Object,
				},
				votes: {
					type: Number,
					default: 0,
				},
			},
		],
		multiOptions: [
			{
				isCorrect: {
					type: Boolean,
				},
				isAlternateCorrect: {
					type: Boolean,
					default: false,
				},
				content: {
					type: Object,
				},
			},
		],
		columns: {
			col1: [
				{
					content: {
						type: Object,
					},
					matches: {
						type: Object,
					},
				},
			],
			col2: [
				{
					content: {
						type: Object,
					},
				},
			],
		},
		integerAnswer: {
			type: Number,
		},
		range: {
			start: Number,
			end: Number,
		},
		type: {
			type: String,
			required: true,
			default: 'MULTIPLE_CHOICE_SINGLE_CORRECT',
		},
		level: {
			type: Number,
			default: 1,
			required: true,
		},
		hint: {
			type: Object,
		},
		solution: {
			type: Object,
		},
		solSubmittedBy: {
			type: ObjectId,
			ref: 'User',
		},
		isVerified: {
			type: Boolean,
			default: false,
		},
		verifiedBy: {
			// remove isVerified. but set verifiedBy with id of super user.
			type: String,
			default: '',
		},
		addedBy: {
			// remove isVerified. but set verifiedBy with id of super user.
			type: ObjectId,
			ref: 'User',
		},
		totalReviews: {
			type: Number,
			default: 0,
		},
		isReviewable: {
			type: Boolean,
			default: false,
		},
		isPublished: {
			type: Boolean,
			default: false,
		},
		isOriginal: {
			type: Boolean,
			default: false,
		},
		tag: {
			type: String,
			default: '',
		},
		hasImage: {
			type: Boolean,
		},
		hasEquation: {
			type: Boolean,
		},
		topicId: {
			type: Number,
		},
		topic: {
			type: String,
		},
		sub_topic: {
			type: String,
			index: true,
		},
		stats: {
			// not used anymore
			attempts: [
				{
					batch: { type: Number },
					mode: { type: String },
					user: { type: ObjectId },
					option: { type: String },
					time: { type: Number },
				},
			],
			computedStats: {
				perfectTimeLimits: {
					min: Number, // lower limit for perfect attempt in seconds
					max: Number, // upper limit for perfect attempt in seconds
				},
				basedOnAttemptsCount: {
					// nummber of attempts used in previous calculation
					type: Number,
					default: 0,
				},
			},
			rating: {
				type: [
					{
						batch: { type: Number },
						initial: { type: Number },
						current: { type: Number },
					},
				],
				default: [
					{
						batch: _batch,
						initial: initialQuestionRatingMedium,
						current: initialQuestionRatingMedium,
					},
				],
			},
		},
		reports: {
			// 0 = Question not from this topic
			// 1 = Question not clear, 2 = Incorrect answer, 9 = custom report
			type: Array,
			default: [],
		},
		link: {
			content: {
				type: Object,
			},
			id: {
				type: ObjectId,
				ref: 'Link',
			},
			sequence_no: Number,
			total_questions: Number,
		},
		used: {
			type: String,
			default: null,
		},
		usedIn: [
			{
				type: ObjectId,
				ref: 'AssessmentCore',
			},
		],
		dataType: {
			// image or text
			type: String,
			default: 'text',
			enum: ['text', 'image'],
		},
		concepts: [
			{
				concept: {
					type: ObjectId,
					ref: 'Concept',
				},
			},
		],
		statistics: {
			type: ObjectId,
			ref: 'QuestionStatistics',
		},
		attemptsCount: {
			type: Number,
			default: 0,
		},
		version: {
			type: Number,
			enum: [0, 1, 2],
			// 0 is where attempts are stored in question
			// 1 is when attempts are moved to Attempt collection
			default: 0,
		},
		subTopic: {
			type: String,
			default: '5ce27e66ff96dd1f72ce9064',
		},
		isArchived: {
			type: Boolean,
			default: false,
		},
		fixed: {
			type: Boolean,
			default: false,
		},
		hiddenInSearch: {
			type: Boolean,
			default: false,
		},
		client: {
			type: ObjectId,
			ref: 'Client',
		},
		tags: [
			{
				key: String,
				value: String,
			},
		],
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
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

QuestionSchema.method('fixContent', function fixContent(this: IQuestion) {
	const { rawContent } = this.toObject().content;
	if (/entityMap":\[/.test(rawContent)) {
		// if entity is an array, convert it to map
		try {
			const parsedRawContent = JSON.parse(rawContent);
			const newEntityMap = {};
			parsedRawContent.entityMap.forEach((item, index) => {
				newEntityMap[index] = item;
			});
			// console.log(parsedRawContent.entityMap, newEntityMap);
			const newRawContent = JSON.stringify({
				...parsedRawContent,
				entityMap: newEntityMap,
			});
			// console.log(newRawContent);
			this.content = { rawContent: newRawContent };
			this.save((error, savedQuestion) => {
				if (error) {
					console.error(error);
				} else {
					console.log('saved question', this._id, savedQuestion.content);
				}
			});
		} catch (e) {
			// report this question
			console.error(e);
		}
	}
});

QuestionSchema.method(
	'changeTypeToSingleCorrect',
	function changeTypeToSingleCorrect(
		this: IQuestion,
		targetType: QuestionTypes,
		newOptions?: QuestionOption[],
		content?: Content
	) {
		const currentType = this.type;
		if (![QuestionTypes.MCSC, QuestionTypes.LINKED_MCSC].includes(targetType)) {
			throw new Error(
				`targetType must be one of ${QuestionTypes.MCSC} or ${QuestionTypes.LINKED_MCSC}`
			);
		}
		if (!isTypeTransitionPossible(currentType, targetType)) {
			throw new Error(
				`Question of type "${currentType}" can not be converted to "${targetType}"`
			);
		}

		if (!newOptions || !newOptions.length) {
			// if no answer change is needed
			if ([QuestionTypes.LINKED_MCMC, QuestionTypes.MCMC].includes(currentType)) {
				this.options = this.multiOptions;
				let firstCorrectMarked = false;
				// only first correct option will be left checked, other correct options will be marked incorrect
				this.options.forEach((option) => {
					if (!firstCorrectMarked && option.isCorrect) {
						firstCorrectMarked = true;
						return;
					}
					option.isCorrect = false;
				});
				this.multiOptions = undefined;
			} else {
				const defaultNewOptions: QuestionOption[] = [];
				for (let index = 0; index < 4; index++) {
					const content = {
						blocks: [{ ...defaultBlock, text: getOptionNameForIndex(index) }],
					};
					defaultNewOptions.push({
						isCorrect: false,
						content: { rawContent: JSON.stringify(content) },
					});
				}
				this.options = defaultNewOptions;
				this.range = undefined;
			}
		} else {
			// if answer change is needed
			if ([QuestionTypes.LINKED_MCMC, QuestionTypes.MCMC].includes(currentType)) {
				// try to preserve vote count
				newOptions.forEach((newOption) => {
					this.multiOptions.forEach((currentOption) => {
						if (newOption._id === currentOption._id) {
							newOption.votes = currentOption.votes;
						}
					});
				});
			}
			this.range = undefined;
			this.multiOptions = undefined;
			this.options = newOptions;
		}
		if (content) {
			this.content = content;
		}
		this.type = targetType;
	}
);

QuestionSchema.method(
	'changeTypeToMultipleCorrect',
	function changeTypeToMultipleCorrect(
		this: IQuestion,
		targetType: QuestionTypes,
		newOptions?: QuestionOption[],
		content?: Content
	) {
		const currentType = this.type;
		if (![QuestionTypes.MCMC, QuestionTypes.LINKED_MCMC].includes(targetType)) {
			throw new Error(
				`targetType must be one of ${QuestionTypes.MCMC} or ${QuestionTypes.LINKED_MCMC}`
			);
		}
		if (!isTypeTransitionPossible(currentType, targetType)) {
			throw new Error(
				`Question of type "${currentType}" can not be converted to "${targetType}"`
			);
		}
		if (!newOptions || !newOptions.length) {
			if ([QuestionTypes.LINKED_MCSC, QuestionTypes.MCSC].includes(currentType)) {
				this.multiOptions = this.options;
				this.options = undefined;
			} else {
				const defaultNewOptions: QuestionOption[] = [];
				for (let index = 0; index < 4; index++) {
					const content = {
						blocks: [{ ...defaultBlock, text: getOptionNameForIndex(index) }],
					};
					// no option will be select by default
					defaultNewOptions.push({
						isCorrect: false,
						content: { rawContent: JSON.stringify(content) },
					});
				}
				this.multiOptions = defaultNewOptions;
				this.range = undefined;
			}
		} else {
			if ([QuestionTypes.LINKED_MCSC, QuestionTypes.MCSC].includes(currentType)) {
				newOptions.forEach((newOption) => {
					this.options.forEach((currentOption) => {
						if (newOption._id === currentOption._id) {
							newOption.votes = currentOption.votes;
						}
					});
				});
			}
			this.options = undefined;
			this.range = undefined;
			this.multiOptions = newOptions;
		}
		if (content) {
			this.content = content;
		}
		this.type = targetType;
	}
);

QuestionSchema.method(
	'changeTypeToRange',
	function changeTypeToRange(
		this: IQuestion,
		targetType: QuestionTypes,
		newRange?: QuestionAnswerRange,
		content?: Content
	) {
		if (![QuestionTypes.RANGE, QuestionTypes.LINKED_RANGE].includes(targetType)) {
			throw new Error(
				`targetType must be one of ${QuestionTypes.RANGE} or ${QuestionTypes.LINKED_RANGE}`
			);
		}
		const currentType = this.type;
		if (!isTypeTransitionPossible(currentType, targetType)) {
			throw new Error(
				`Question of type "${currentType}" can not be converted to "${targetType}"`
			);
		}

		this.multiOptions = undefined;
		this.options = undefined;
		this.range = newRange || { start: 0, end: 0 };
		if (content) {
			this.content = content;
		}
		this.type = targetType;
	}
);

/**
 * Statics
 */
QuestionSchema.statics = {
	/**
	 * Get question
	 * @param {ObjectId} id - The objectId of question.
	 * @returns {Promise<Question, APIError>}
	 */
	get(this: QuestionModel, id: Types.ObjectId | string) {
		return this.findById(id).populate('statistics').exec();
	},

	getForReview(this: QuestionModel, id: Types.ObjectId | string) {
		return this.findById(id)
			.populate({ path: 'solSubmittedBy', select: 'username dp' })
			.exec();
	},

	getManyByIds(this: QuestionModel, ids: (Types.ObjectId | string)[]) {
		return this.find({ _id: { $in: ids } });
	},

	async getMany(
		this: QuestionModel,
		tag: string,
		subTopic: string,
		questionType: QuestionType | 'LINKED' | '',
		questionState: string,
		level: string | number,
		showHidden: any,
		skip: number,
		limit: number = 20,
		clientId: string | RegExp | Types.ObjectId,
		dataType: string | RegExp | QuerySelector<RegExp | 'text' | 'image'>,
		tags: { key: string; value: string }[],
		concepts: any[],
		questionIds: any[]
	) {
		let query: MongooseFilterQuery<IQuestion> = { isArchived: { $ne: true } };

		if (clientId) {
			query.client = { $in: [null, clientId] };
		}

		if (tag !== '') {
			if (/^[0-9a-fA-F]{24}$/.test(tag) && questionType !== 'LINKED') {
				query._id = tag;
			} else {
				query.tag = tag;
			}
		}

		if (showHidden) {
			//
		} else {
			query.hiddenInSearch = { $ne: true };
		}

		if (subTopic !== '') query.sub_topic = subTopic;
		if (dataType) {
			query.dataType = dataType;
		}

		if (questionType !== '' && questionType !== 'LINKED') {
			query.type = questionType;
			const tempQuery1 = { ...query };
			const tempQuery2 = { ...query };
			tempQuery1.link = { $exists: true, $eq: {} };
			tempQuery2.link = { $exists: false };
			query = { $or: [tempQuery1, tempQuery2] };
		} else if (questionType === 'LINKED') {
			query.link = { $exists: true, $ne: {} };
		} else {
			const tempQuery1 = { ...query };
			const tempQuery2 = { ...query };
			tempQuery1.link = { $exists: true, $eq: {} };
			tempQuery2.link = { $exists: false };
			query = { $or: [tempQuery1, tempQuery2] };
		}

		if (questionState === 'VERIFIED') {
			query.verifiedBy = { $ne: '' };
		} else if (questionState === 'NOT-VERIFIED') {
			query.verifiedBy = '';
		} else if (questionState === 'PUBLISHED') {
			query.isPublished = true;
		} else if (questionState === 'VERIFIED-NOT-PUBLISHED') {
			query.verifiedBy = { $ne: '' };
			query.isPublished = false;
		} else if (questionState === 'VERIFIED-NOT-PUBLISHED-NOTUSED') {
			query.verifiedBy = { $ne: '' };
			query.isPublished = false;
			// query.used = null;
		} else if (questionState === 'VERIFIED-NOT-PUBLISHED-NOTUSED-WITHSOLUTION') {
			query.verifiedBy = { $ne: '' };
			query.isPublished = false;
			// query.used = null;
			query['solution.rawContent'] = {
				$not: /{\"blocks\":\[{\"key\":\"[a-zA-Z0-9]+\",\"text\":\"\",\"type\":\"unstyled\",\"depth\":0,\"inlineStyleRanges\":\[\],\"entityRanges\":\[\],\"data\":{}}],\"entityMap\":{}}/,
			};
		} else if (questionState === 'NOT-VERIFIED-PUBLISHED') {
			query.verifiedBy = '';
			query.isVerified = { $ne: true };
			query.isPublished = true;
		} else if (questionState === 'WITHOUT-SOLUTION') {
			query['solution.rawContent'] = {
				$regex: /{\"blocks\":\[{\"key\":\"[a-zA-Z0-9]+\",\"text\":\"\",\"type\":\"unstyled\",\"depth\":0,\"inlineStyleRanges\":\[\],\"entityRanges\":\[\],\"data\":{}}],\"entityMap\":{}}/,
			};
		} else if (questionState === 'REPORTED') {
			query.reports = { $nin: [[]] };
		}

		if (level !== '' && typeof level !== 'string') {
			query.level = level;
		}

		if (tags) {
			tags.forEach((tag) => {
				if (!query.tags) {
					query.tags = { $elemMatch: { $or: [] } };
				}
				query.tags['$elemMatch']['$or'].push({
					key: { $regex: new RegExp(tag.key, 'i') },
					value: { $regex: new RegExp(tag.value, 'i') },
				});
				// query.tags = {
				// 	$elemMatch: {
				// 		key: { $regex: new RegExp(tag.key, 'i') },
				// 		value: { $regex: new RegExp(tag.value, 'i') },
				// 	},
				// };
				// console.log(JSON.stringify(query.tags));
			});
		}
		if (concepts) {
			concepts.forEach((concept) => {
				if (!query.concepts) {
					query.concepts = { $elemMatch: { $or: [] } };
				}
				query.concepts['$elemMatch']['$or'].push({
					concept,
				});
			});
		}
		if (Array.isArray(questionIds) && questionIds.length) {
			query._id = {
				$in: questionIds,
			};
		}
		// console.log(JSON.stringify(query));

		const sorter = questionType === 'LINKED' ? { _id: 1 } : { randomId: 1 };

		const total = await this.countDocuments(query);
		return this.find(query)
			.sort(sorter)
			.skip(skip)
			.limit(limit)
			.populate([
				{
					path: 'usedIn',
					select: 'identifier wrappers',
					populate: [{ path: 'wrappers.wrapper', select: 'name' }],
				},
			])
			.exec()
			.then((questions) => ({ questions, total }));
	},

	searchByTag(
		this: QuestionModel,
		tag: string,
		from_: Date | string,
		to_: Date | string
	) {
		return this.find({
			tag,
			createdAt: {
				$gt: new Date(from_),
				$lt: new Date(to_),
			},
		}).exec();
	},

	verifyByTag(
		this: QuestionModel,
		tag: string,
		from_: Date | string,
		to_: Date | string,
		id: string
	) {
		return this.updateMany(
			{
				tag,
				createdAt: {
					$gt: new Date(from_),
					$lt: new Date(to_),
				},
			},
			{ $set: { verifiedBy: id } }
		).exec();
	},

	deleteMany(this: QuestionModel, ids: (string | ObjectId)[]) {
		return this.remove({ _id: { $in: ids } }).exec();
	},

	getReported(this: QuestionModel, skip: number) {
		const query: MongooseFilterQuery<IQuestion> = { reports: { $nin: [[]] } };
		return this.find(query)
			.skip(skip)
			.limit(10)
			.exec()
			.then((questions) => questions);
	},

	listOne(
		this: QuestionModel,
		{
			category,
			key,
			attemptedQuestions = [],
			allowedTopics,
		}: {
			category?: string;
			key?: string;
			attemptedQuestions?: (string | Types.ObjectId)[];
			allowedTopics?: [];
		} = {}
	) {
		if (category === 'topic') {
			const query: MongooseFilterQuery<IQuestion> = {
				sub_topic: key,
				_id: { $nin: attemptedQuestions },
				isPublished: true,
			};
			return this.findOne(query).sort({ randomId: 1 }).exec();
		}
		if (category === 'difficulty') {
			if (key === 'easy') {
				const query: MongooseFilterQuery<IQuestion> = {
					level: 1,
					_id: { $nin: attemptedQuestions },
					topic: { $in: allowedTopics },
					isPublished: true,
				};
				return this.findOne(query).sort({ randomId: 1 }).exec();
			}
			if (key === 'medium') {
				const query: MongooseFilterQuery<IQuestion> = {
					level: 2,
					_id: { $nin: attemptedQuestions },
					topic: { $in: allowedTopics },
					isPublished: true,
				};
				return this.findOne(query).sort({ randomId: 1 }).exec();
			}
			if (key === 'hard') {
				const query: MongooseFilterQuery<IQuestion> = {
					level: 3,
					_id: { $nin: attemptedQuestions },
					topic: { $in: allowedTopics },
					isPublished: true,
				};
				return this.findOne(query).sort({ randomId: 1 }).exec();
			}
			return null;
		}
		return null; // handle error!
	},

	searchQuestions(
		this: QuestionModel,
		searchQuestions: { sub_topic: any; level: any; count: number }[]
	) {
		// only not used questions
		const self = this;
		const asyncfunctions = searchQuestions.map(
			(sq: { sub_topic: any; level: any; count: number }, idx: number) => {
				if (idx === 0) {
					return function (
						done: (
							arg0: any,
							arg1:
								| IQuestion[]
								| { error: { code: string; sub_topic: any; level: any } }[]
						) => void
					) {
						self
							.find({
								sub_topic: sq.sub_topic,
								level: sq.level,
								used: null,
								isPublished: false,
								verifiedBy: { $nin: [''] },
							})
							.sort({ randomId: 1 })
							.limit(sq.count)
							.exec()
							.then((questions) => {
								if (questions.length !== sq.count) {
									done(null, [
										{
											error: {
												code: 'not-enough-questions',
												sub_topic: sq.sub_topic,
												level: sq.level,
											},
										},
									]);
								} else {
									done(null, questions);
								}
							});
					};
				}
				return function (q, done) {
					self
						.find({
							sub_topic: sq.sub_topic,
							level: sq.level,
							used: null,
							isPublished: false,
							verifiedBy: { $nin: [''] },
						})
						.sort({ randomId: 1 })
						.limit(sq.count)
						.exec()
						.then((questions) => {
							if (questions.length !== sq.count) {
								q.push({
									error: {
										code: 'not-enough-questions',
										sub_topic: sq.sub_topic,
										level: sq.level,
									},
								});
							} else {
								questions.forEach((q_) => {
									q.push(q_);
								});
							}
							done(null, q);
						});
				};
			}
		);
		return new Promise((resolve, reject) => {
			waterfall(asyncfunctions, (err, result) => {
				if (err) reject({ err });
				else resolve(result);
			});
		});
	},

	searchUnpublishedQuestions(
		this: QuestionModel,
		searchQuestions: { sub_topic: any; type: any; level: any; count: number }[]
	) {
		const self = this;
		const asyncfunctions = searchQuestions.map(
			(
				question: { sub_topic: any; type: any; level: any; count: number },
				idx: number
			) => {
				if (idx === 0) {
					return function (
						done: (
							arg0: any,
							arg1:
								| IQuestion[]
								| { error: { code: string; sub_topic: any; level: any } }[]
						) => void
					) {
						self
							.find({
								sub_topic: question.sub_topic,
								type: question.type,
								level: question.level,
								isPublished: false,
								verifiedBy: { $nin: [''] },
							})
							.sort({ randomId: 1 })
							.limit(question.count)
							.exec()
							.then((questions) => {
								if (questions.length !== question.count) {
									done(null, [
										{
											error: {
												code: 'not-enough-questions',
												sub_topic: question.sub_topic,
												level: question.level,
											},
										},
									]);
								} else {
									done(null, questions);
								}
							});
					};
				}
				return function (q, done) {
					self
						.find({
							sub_topic: question.sub_topic,
							type: question.type,
							level: question.level,
							isPublished: false,
							verifiedBy: { $nin: [''] },
						})
						.sort({ randomId: 1 })
						.limit(question.count)
						.exec()
						.then((questions) => {
							if (questions.length !== question.count) {
								q.push({
									error: {
										code: 'not-enough-questions',
										sub_topic: question.sub_topic,
										level: question.level,
									},
								});
							} else {
								questions.forEach((q_) => {
									q.push(q_);
								});
							}
							done(null, q);
						});
				};
			}
		);
		return new Promise((resolve, reject) => {
			waterfall(asyncfunctions, (err, result) => {
				if (err) reject({ err });
				else resolve(result);
			});
		});
	},

	updateStats(this: QuestionModel, id: string | Types.ObjectId, attempts) {
		this.get(id).then((question) => {
			const finalAttempts = [];
			attempts.forEach((a) => {
				let found = false;
				question.stats.attempts.forEach((b) => {
					if (a.mode === b.mode && a.user.toString() === b.user.toString()) {
						found = true;
					}
				});
				if (!found) finalAttempts.push(a);
			});
			question.stats.attempts.push.apply(question.stats.attempts, finalAttempts);
			question.markModified('stats.attempts');
			question.save();
		});
	},
};

const getOptionNameForIndex = (index: number) => {
	const names = ['A', 'B', 'C', 'D', 'E', 'F'];
	return `${names[index]})`;
};
const defaultBlock = {
	key: '4biil',
	text: '',
	type: 'unstyled',
	depth: 0,
	inlineStyleRanges: [],
	entityRanges: [],
	data: {},
};

QuestionSchema.virtual('getOptions').get(function getOptions(
	this: IQuestion
): QuestionOption[] {
	if (this.dataType === 'image') {
		if (!Array.isArray(this.options) || this.options.length === 0) {
			this.options = [{}, {}, {}, {}];
		}
		return this.options.map((option, index) => {
			let rawContent;
			try {
				rawContent = JSON.parse(option.content.rawContent);
			} catch (e) {
				rawContent = {
					blocks: [{ ...defaultBlock }],
					entityMap: {},
				};
			}
			const modifiedContent = {
				blocks: [
					Object.assign(rawContent.blocks[0], {
						text: rawContent.blocks[0].text || getOptionNameForIndex(index),
					}),
				],
			};
			return {
				...option.toObject(),
				content: { rawContent: JSON.stringify(modifiedContent) },
			};
		});
	}
	return this.options;
});

export default model<IQuestion, QuestionModel>('Question', QuestionSchema);
