import { AllTopics, SubTopic, Topic } from './Topic';

export const getSubTopicForSubTopicNumericId = (
	topics: AllTopics,
	subTopicId: number
) => {
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
};

export const getTopicForSubTopicNumericId = (
	topics: AllTopics,
	subTopicId: number
) => {
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
};

export const getSubTopicForId = (topics: AllTopics, subTopicId: string) => {
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
};

export const getTopicForSubTopicId = (
	topics: AllTopics,
	subTopicId: string
) => {
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
};
