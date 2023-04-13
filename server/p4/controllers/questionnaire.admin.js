const Questionnaire = require('../models/Questionnaire');
const Question = require('../models/Question');
const Paragraph = require('../models/Paragraph');
const Option = require('../models/Option');
const APIError = require('../../helpers/APIError');

const createOption = (req, res, next) => {
	const { content } = req.body;
	const option = new Option({ content });
	option.save((error) => {
		if (error) {
			next(new APIError(error, 422));
		} else {
			res.send({ option });
		}
	});
};

const createParagraph = (req, res, next) => {
	const { content } = req.body;
	const paragraph = new Paragraph({ content });
	paragraph.save((error) => {
		if (error) {
			next(new APIError(error, 422));
		} else {
			res.send({ paragraph });
		}
	});
};

const createQuestion = (req, res, next) => {
	const { answer, content, options, paragraph, tags, type } = req.body;
	const question = new Question({
		answer,
		content,
		options,
		paragraph,
		tags,
		type,
	});
	question.save((error) => {
		if (error) {
			next(new APIError(error, 422));
		} else {
			res.send({ question });
		}
	});
};

const createQuestionnaire = (req, res, next) => {
	const { config, groups, questionItems, sections, title } = req.body;
	const questionnaire = new Questionnaire({
		config,
		groups,
		questionItems,
		sections,
		title,
	});
	questionnaire.save((error) => {
		if (error) {
			next(new APIError(error, 422));
		} else {
			res.send({ questionnaire });
		}
	});
};

const getQuestion = (req, res, next) => {
	const { _id } = req.query;
	Question.findOne({ _id })
		.then((question) => {
			if (!question) {
				next(new APIError('', 404));
			} else {
				res.send({ question });
			}
		})
		.catch((error) => next(new APIError(error, 500)));
};

const getQuestionnaire = (req, res, next) => {
	const { _id } = req.body;
	Questionnaire.findOne({ _id })
		.populate('questionItems.question')
		.then((questionnaire) => {
			if (!questionnaire) {
				next(new APIError('', 404));
			} else {
				res.send({ questionnaire });
			}
		})
		.catch((error) => next(new APIError(error, 500)));
};

const listQuestionnaires = (req, res, next) => {
	Questionnaire.find()
		.then((questionnaires) => {
			res.send(questionnaires);
		})
		.catch((error) => next(new APIError(error, 500)));
};

const listQuestions = (req, res, next) => {
	const { tags } = req.query;
	Question.find({ tags })
		.then((questions) => {
			res.send({ questions });
		})
		.catch((error) => {
			next(new APIError(error, 500));
		});
};

const updateOption = (req, res, next) => {
	const { _id, content } = req.body;
	Option.findOne({ _id })
		.then((option) => {
			if (!option) {
				next(new APIError('Not found', 404));
			} else {
				option.set('content', content);
				option.save((error) => {
					if (error) {
						next(new APIError(error, 422));
					} else {
						res.send({ option });
					}
				});
			}
		})
		.catch((error) => next(new APIError(error, 500)));
};

const updateParagraph = (req, res, next) => {
	const { _id, content } = req.body;

	Paragraph.findOne({ _id })
		.then((paragraph) => {
			if (!paragraph) {
				next(new APIError('Not found', 404));
			} else {
				paragraph.set('content', content);
				paragraph.save((error) => {
					if (error) {
						next(new APIError(error, 422));
					} else {
						res.send({ paragraph });
					}
				});
			}
		})
		.catch((error) => next(new APIError(error, 500)));
};

const updateQuestion = (req, res, next) => {
	const { _id, answer, content, options, paragraph, tags, type } = req.body;

	Question.findOne({ _id })
		.then((question) => {
			if (!question) {
				next(new APIError('Not found', 404));
			} else {
				question.set('content', content);
				question.set('answer', answer);
				question.set('options', options);
				question.set('tags', tags);
				question.set('paragraph', paragraph);
				question.set('type', type);
				question.save((error) => {
					if (error) {
						next(new APIError(error, 422));
					} else {
						res.send({ question });
					}
				});
			}
		})
		.catch((error) => next(new APIError(error, 500)));
};

const updateQuestionnaire = (req, res, next) => {
	const { _id, config, groups, questionItems, sections, title } = req.body;

	Questionnaire.findOne({ _id })
		.then((questionnaire) => {
			if (!questionnaire) {
				next(new APIError('Not found', 404));
			} else {
				questionnaire.set('config', config);
				questionnaire.set('groups', groups);
				questionnaire.set('questionItems', questionItems);
				questionnaire.set('sections', sections);
				questionnaire.set('title', title);
				questionnaire.save((error) => {
					if (error) {
						next(new APIError(error, 422));
					} else {
						res.send({ questionnaire });
					}
				});
			}
		})
		.catch((error) => next(new APIError(error, 500)));
};

module.exports = {
	createOption,
	createParagraph,
	createQuestion,
	createQuestionnaire,
	getQuestion,
	getQuestionnaire,
	listQuestionnaires,
	listQuestions,
	updateOption,
	updateParagraph,
	updateQuestion,
	updateQuestionnaire,
};
