const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ObjectId = Schema.Types.ObjectId;

const Answer = new Schema({
	option: ObjectId,
	questionItemId: ObjectId,
});

const QuestionnaireResponse = new Schema(
	{
		answers: [Answer],
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model(
	'P4QuestionnaireResponse',
	QuestionnaireResponse
);
