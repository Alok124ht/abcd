const User = require('./user.model').default;
const { userTopics } = require('./lib');
const { getIconForSubTopic } = require('../topic/icons');

const subjectsByKey = {
	physics: {
		name: 'Physics',
		key: 'physics',
		_id: 'physics',
		config: {
			subTopics: {
				scrollHorizontal: true,
			},
		},
	},
	mathematics: {
		name: 'Mathematics',
		shortName: 'Maths',
		key: 'mathematics',
		_id: 'mathematics',
		config: {
			subTopics: {
				scrollHorizontal: true,
			},
		},
	},
	chemistry: {
		name: 'Chemistry',
		key: 'chemistry',
		_id: 'chemistry',
		config: {
			subTopics: {
				scrollHorizontal: true,
			},
		},
	},
	quant: {
		name: 'Quantitative Aptitude',
		shortName: 'Quant',
		key: 'quant',
		_id: 'quant',
		config: {
			subTopics: {
				scrollHorizontal: false,
			},
		},
	},
	varc: {
		name: 'VARC',
		key: 'VARC',
		_id: 'VARC',
		config: {
			subTopics: {
				scrollHorizontal: true,
			},
		},
	},
};

const subjectKeysByTag = {
	mechanics1: 'physics',
	mechanics2: 'physics',
	'fluids and heat': 'physics',
	'electricity and magnetism': 'physics',
	'optics and waves': 'physics',
	'modern physics': 'physics',
	'algebra & trigonometry': 'mathematics',
	geometry: 'mathematics',
	calculas: 'mathematics',
	'matrices & vectors': 'mathematics',
	'probability & statistics': 'mathematics',
	'integral calculas': 'mathematics',
	'physical chemistry 1': 'chemistry',
	'physical chemistry 2': 'chemistry',
	'organic chemistry 1': 'chemistry',
	'organic chemistry 2': 'chemistry',
	'inorganic chemistry 1': 'chemistry',
	'inorganic chemistry 2': 'chemistry',
	quant: 'quant',
	varc: 'varc',
};

const transformTopicsToSubjects = (topics) => {
	const subjects = {};
	if (topics) {
		topics.forEach((topic) => {
			if (topic && Array.isArray(topic.sub_topics)) {
				topic.sub_topics.forEach((subTopic) => {
					const subjectKey = subjectKeysByTag[subTopic.tag];
					const subject = subjectsByKey[subjectKey];
					if (!subject) {
						console.error(
							`no mapping for topic: "${topic.name}", subTopic:"${
								subTopic && subTopic.name
							}", tag "${subTopic.tag}" found in subjectsByTag`
						);
					} else {
						if (!subjects[subject.key]) {
							subjects[subject.key] = Object.assign(
								{
									config: {
										subTopics: {
											scrollHorizontal: true,
										},
									},
								},
								subject,
								{
									topics: {},
								}
							);
						}

						if (!subjects[subject.key].topics[topic._id]) {
							subjects[subject.key].topics[topic._id] = Object.assign(
								{ subjectId: subject._id },
								topic,
								{
									sub_topics: undefined,
									subTopics: [],
								}
							);
						}
						subjects[subject.key].topics[topic._id].subTopics.push(subTopic);
					}
				});
			}
		});
	}
	return subjects;
};

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
	const populate = [
		{ path: 'category' },
		{
			path: 'subscriptions.subgroups.phases.phase',
			select:
				'topicMocks sectionalMocks fullMocks liveTests endDate topics series',
		},
	];

	const handleError = (error, options) => {
		const { errorCode, status } = options || {};
		if (error && error.message) {
			res.status(status || 500).send({ errorCode, error });
		} else {
			res.status(500).send({ message: 'Internal server error' });
		}
	};
	const transformSubTopics = (subTopics) =>
		subTopics
			.filter((subTopic) => !subTopic.hide)
			.map((subTopic) =>
				Object.assign(
					{ icons: [{ size: 200, url: getIconForSubTopic(subTopic) }] },
					{
						name: subTopic.name,
						_id: subTopic._id,
						difficulty: subTopic.difficulty,
						published_questions: subTopic.published_questions,
						percent_complete: subTopic.percent_complete,
						tag: subTopic.tag,
					}
				)
			);

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
					difficulty: topic.difficulty,
					percent_complete: topic.percent_complete,
					sub_topics: transformSubTopics(topic.sub_topics),
				};
			})
			.filter((topic) => !!topic);

	User.findById(req.payload.id, projection)
		.populate(populate)
		.then((user) => {
			userTopics(user)
				.then((topicData) => {
					const transformedTopics = transformTopics(topicData.topics);
					const subjects = transformTopicsToSubjects(transformedTopics);
					if (req.query.client === 'MAAN') {
						res.send(
							Object.keys(subjects)
								.map((s) => subjects[s])
								.map((s) =>
									Object.assign({}, s, {
										topics: Object.keys(s.topics).map((ss) => s.topics[ss]),
									})
								)
						);
					} else {
						res.send({
							topics: transformedTopics,
							subjects,
						});
					}
				})
				.catch(handleError);
		})
		.catch(handleError);
};

module.exports = {
	getSubscribedTopics,
};
