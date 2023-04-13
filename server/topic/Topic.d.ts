import { Document, Types, Model } from 'mongoose';

interface TopicBase {
	name: string;
	_id: Types.ObjectId;
}

interface SubTopic extends TopicBase {
	concepts: any[];
	id: number;
}

export interface Topic extends TopicBase {
	sub_topics: SubTopic[];
}

export interface AllTopics extends Document {
	topics: Topic[];
	createdAt: Date;
	updatedAt: Date;
}

export interface AllTopicsModel extends Model<AllTopics> {
	list(): Promise<AllTopics>;
	getTopics(this: AllTopicsModel): Promise<Topic[]>;
	getSubTopics(
		this: AllTopicsModel
	): Promise<
		{
			_id: Types.ObjectId;
			name: string;
			parent: {
				_id: Types.ObjectId;
				name: string;
			};
		}[]
	>;
	getSubTopicForSubTopicNumericId(
		this: AllTopicsModel,
		subTopicId: number
	): Promise<SubTopic>;
	getTopicForSubTopicNumericId(
		this: AllTopicsModel,
		subTopicId: number
	): Promise<Topic>;
	getSubTopicForId(this: AllTopicsModel, subTopicId: string): Promise<SubTopic>;
	getTopicForSubTopicId(
		this: AllTopicsModel,
		subTopicId: string
	): Promise<Topic>;
}
