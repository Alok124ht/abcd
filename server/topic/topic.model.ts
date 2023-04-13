import { Schema, model, Types } from 'mongoose';
import { forEach, get } from 'lodash';
import { AllTopics, AllTopicsModel, Topic, SubTopic } from './Topic';

const { ObjectId } = Schema.Types;

const TopicSchema = new Schema(
	{
		topics: [
			{
				name: String,
				average_test_performance: {
					sumTime: {
						type: Number,
						default: 0,
					},
					sumSqTime: {
						type: Number,
						default: 0,
					},
					sumAccuracy: {
						type: Number,
						default: 0,
					},
					sumSqAccuracy: {
						type: Number,
						default: 0,
					},
					totalQuestions: {
						type: Number,
						default: 0,
					},
				},
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
					average_test_performance: {
						// change db structure
						easy: {
							sumTime: {
								type: Number,
								default: 0,
							},
							sumSqTime: {
								type: Number,
								default: 0,
							},
							sumAccuracy: {
								type: Number,
								default: 0,
							},
							sumSqAccuracy: {
								type: Number,
								default: 0,
							},
							totalQuestions: {
								type: Number,
								default: 0,
							},
						},
						medium: {
							sumTime: {
								type: Number,
								default: 0,
							},
							sumSqTime: {
								type: Number,
								default: 0,
							},
							sumAccuracy: {
								type: Number,
								default: 0,
							},
							sumSqAccuracy: {
								type: Number,
								default: 0,
							},
							totalQuestions: {
								type: Number,
								default: 0,
							},
						},
						hard: {
							sumTime: {
								type: Number,
								default: 0,
							},
							sumSqTime: {
								type: Number,
								default: 0,
							},
							sumAccuracy: {
								type: Number,
								default: 0,
							},
							sumSqAccuracy: {
								type: Number,
								default: 0,
							},
							totalQuestions: {
								type: Number,
								default: 0,
							},
						},
					},
				},
				sub_topics: [
					{
						name: String,
						id: Number,
						average_test_performance: {
							sumTime: {
								type: Number,
								default: 0,
							},
							sumSqTime: {
								type: Number,
								default: 0,
							},
							sumAccuracy: {
								type: Number,
								default: 0,
							},
							sumSqAccuracy: {
								type: Number,
								default: 0,
							},
							totalQuestions: {
								type: Number,
								default: 0,
							},
						},
						total_questions: {
							type: Number,
							default: 0,
						},
						verified_questions: {
							type: Number,
							default: 0,
						},
						published_questions: {
							type: Number,
							default: 0,
						},
						difficulty: {
							easy: {
								type: Number,
								default: 0,
							},
							medium: {
								type: Number,
								default: 0,
							},
							hard: {
								type: Number,
								default: 0,
							},
						},
						completedBy: {
							type: Array,
							default: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
						},
						attemptHist: [
							{
								count: Number,
								binName: String,
							},
						],
						conceptHist: [
							{
								count: Number,
								binName: String,
							},
						],
						tag: {
							type: String,
							default: '',
						},
						concepts: [
							{
								concept: {
									type: ObjectId,
									ref: 'Concept',
								},
							},
						],
						dataLevel: {
							type: Number,
							default: 0,
						},
						calibrationDate: {
							type: Date,
							default: Date.now,
						},
						availableFor: {
							type: Array,
							default: [],
						},
					},
				],
			},
		],
		puzzles: {
			total: {
				type: Number,
				default: 0,
			},
			verified: {
				type: Number,
				default: 0,
			},
			published: {
				type: Number,
				default: 0,
			},
		},
		calibrationDate: Date,
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

TopicSchema.statics = {
	list(this: AllTopicsModel): Promise<AllTopics> {
		// why not findOne
		return this.findOne().populate('topics.sub_topics.concepts.concept').exec();
	},

	getTopics(this: AllTopicsModel) {
		// take subscription as argument!?
		return this.findOne()
			.exec()
			.then((topics) => (topics ? topics.topics : []));
	},
	getSubTopics(this: AllTopicsModel) {
		return this.list().then((topics) => {
			const subTopics: {
				_id: Types.ObjectId;
				name: string;
				parent: { _id: Types.ObjectId; name: string };
			}[] = [];
			forEach(topics.topics, (topic) => {
				forEach(get(topic, 'sub_topics'), (subTopic) => {
					subTopics.push({
						_id: subTopic._id,
						name: subTopic.name,
						parent: { _id: topic._id, name: topic.name },
					});
				});
			});
			return subTopics;
		});
	},
	getSubTopicForSubTopicNumericId(this: AllTopicsModel, subTopicId: number) {
		return this.list().then((topics) => {
			let searchedSubTopic: SubTopic = null;
			topics.topics.some((topic) => {
				return topic.sub_topics.some((subTopic) => {
					if (subTopic.id === subTopicId) {
						searchedSubTopic = subTopic;
						return true;
					}
				});
			});
			return searchedSubTopic;
		});
	},
	getTopicForSubTopicNumericId(this: AllTopicsModel, subTopicId: number) {
		return this.list().then((topics) => {
			let searchedTopic: Topic = null;
			topics.topics.some((topic) => {
				return topic.sub_topics.some((subTopic) => {
					if (subTopic.id === subTopicId) {
						searchedTopic = topic;
						return true;
					}
				});
			});
			return searchedTopic;
		});
	},
	getSubTopicForId(this: AllTopicsModel, subTopicId: string) {
		return this.list().then((topics) => {
			let searchedSubTopic: SubTopic = null;
			topics.topics.some((topic) => {
				return topic.sub_topics.some((subTopic) => {
					if (subTopic._id.equals(subTopicId)) {
						searchedSubTopic = subTopic;
						return true;
					}
				});
			});
			return searchedSubTopic;
		});
	},
	getTopicForSubTopicId(this: AllTopicsModel, subTopicId: string) {
		return this.list().then((topics) => {
			let searchedTopic: Topic = null;
			topics.topics.some((topic) => {
				return topic.sub_topics.some((subTopic) => {
					if (subTopic._id.equals(subTopicId)) {
						searchedTopic = topic;
						return true;
					}
				});
			});
			return searchedTopic;
		});
	},
};

export default model<AllTopics, AllTopicsModel>('Topic', TopicSchema);
