import { Document, Model, Schema, Types, model } from 'mongoose';
import { waterfall } from 'async';

const { ObjectId } = Schema.Types;

interface PracticeSessionBase {}

interface PracticeSessionDocument extends PracticeSessionBase, Document {
	user: Types.ObjectId;
	title: string;
	category: string;
	key: string;
	subtopics: string[];
	filters: { subTopic: string; level: number; levels: number[] }[];
	startTime: Date;
	endTime: Date;
	hasEnded: boolean;
	xpEarned: number;
	note: {
		type: 'text';
		data: string;
		updatedAt: Date;
	};
	questions: PracticeSessionQuestionItem[];
	selectedQuestionsToAttempt: Types.ObjectId[];
	selectedQuestionsNotToAttempt: Types.ObjectId[];
	version: 0 | 1;
	/**
	 * Where did this sessions start from
	 */
	reference: Types.ObjectId;
	onModel: 'Assessment';
	createdAt: Date;
	updatedAt: Date;
}

interface PracticeSessionQuestionItem {
	id: string;
	question: Types.ObjectId;
	attempt: Types.ObjectId;
	level: number;
	subTopic: string;
}

interface PracticeSessionModelInterface extends Model<PracticeSessionDocument> {
	get(id: string | Types.ObjectId): Promise<PracticeSessionDocument>;
	searchQuestion(
		sessions: any[],
		question: string
	): Promise<string | Types.ObjectId>;
}

const SessionSchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		title: String,
		category: {
			// topic, difficulty, time-control, etc etc
			type: String,
			// required: true,
		},
		key: {
			// topic id for topic/ easy medium hard for difficulty
			type: String,
			// required: true,
		},
		subtopics: [
			// redundant
			{
				type: String,
			},
		],
		filters: [
			{
				subTopic: String,
				level: Number,
				levels: {
					type: [Number],
				},
			},
		],
		startTime: {
			type: Date,
			default: Date.now,
		},
		endTime: {
			type: Date,
		},
		hasEnded: {
			type: Boolean,
			default: false,
		},
		xpEarned: {
			type: Number,
			default: 0,
		},
		note: {
			type: { type: String, enum: 'text', default: 'text' },
			data: {
				type: String,
				default: '',
			},
			updatedAt: Date,
		},
		config: {
			// TODO: add other features
			// timeLimit in seconds
			timeLimit: {
				type: Number,
			},
			questionSelectionTimeLimit: { type: Number },
			tooFastMultiplier: {
				type: Number,
			},
			alertBeforeTooSlow: {
				type: Number,
				// undefined will mean not to notify
			},
			clockType: {
				type: String,
				enum: ['stopwatch', 'timer'],
			},
			questions: {
				total: Number,
				// first Select {shouldSelect} / {total} question and then do attempt them
				shouldSelect: Number, // shouldSelect < total
				maximum: Number, // NOT USED
			},
			tooSlowDetector: {
				type: String,
				enum: ['tooSlow', 'preventUnseenQuestions', 'median'],
			},
			questionSwitchPrenventFn: {
				type: String,
				enum: ['preventReattemptBeforeViewingAllQuestions'],
			},
			prevent: {
				tooFast: Boolean,
				tooSlow: Boolean,
				questionSwitch: Boolean, // not yet implemented on frontend
				reattempt: { type: Boolean, default: true },
				skip: { type: Boolean, default: true },
			},
			selector: String,
			sessionType: {
				type: String,
				enum: [
					'normal',
					'intent',
					'endurance',
					'selectivity',
					'stubbornness',
					'stamina',
				],
			},
		},
		questions: [
			{
				id: String,
				question: {
					type: ObjectId,
					ref: 'Question',
					required: true,
				},
				attempt: {
					type: ObjectId,
					ref: 'Attempt',
					required: true,
				},
				level: Number,
				subTopic: String,
			},
		],
		selectedQuestionsToAttempt: [{ type: ObjectId, ref: 'Question' }],
		selectedQuestionsNotToAttempt: [{ type: ObjectId, ref: 'Question' }],
		version: {
			type: Number,
			enum: [0, 1],
			// 0 is where session is not migrated
			// 1 is where session is migrated
			default: 0,
		},
		reference: {
			type: ObjectId,
			refPath: 'onModel',
		},
		onModel: {
			type: String,
			enum: ['Assessment'],
		},
	},
	{
		timestamps: true,
		usePushEach: true,
	}
);

SessionSchema.statics = {
	async get(this: PracticeSessionModelInterface, id: string | Types.ObjectId) {
		return await this.findOne({ _id: id });
	},

	searchQuestion(
		this: PracticeSessionModelInterface,
		sessions: any[],
		question: string
	): Promise<string | Types.ObjectId> {
		const self = this;
		const asyncfunctions = sessions.map((session, idx) => {
			// wtf??
			if (idx === 0) {
				return function _(done: (error: any, result: Types.ObjectId) => void) {
					self
						.findOne({ _id: session._id })
						.exec()
						.then((s) => {
							let found = '';
							s.questions.forEach((q) => {
								if (q.id === question) found = session._id;
							});
							done(null, found);
						});
				};
			}
			return function _(status, done) {
				if (status) {
					done(null, status);
				} else {
					self
						.findOne({ _id: session._id })
						.exec()
						.then((s) => {
							let found = '';
							s.questions.forEach((q) => {
								if (q.id === question) found = session._id;
							});
							done(null, found);
						});
				}
			};
		});
		return new Promise((resolve, reject) => {
			waterfall(asyncfunctions, (err, result) => {
				if (err) reject({ err });
				else resolve(result);
			});
		});
	},
};

const PracticeSessionModel = model<
	PracticeSessionDocument,
	PracticeSessionModelInterface
>('Session', SessionSchema);

export default PracticeSessionModel;
