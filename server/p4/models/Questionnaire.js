const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const Mixed = Schema.Types.Mixed;

const QuestionnaireSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
		},
		config: {
			markingScheme: {
				correct: {
					type: Number,
					required: true,
				},
				incorrect: {
					type: Number,
					required: true,
				},
				unattempted: {
					type: Number,
					required: true,
				},
			},
		},
		sections: [
			{
				name: String,
			},
		],
		groups: [
			{
				name: String,
				visible: Mixed,
				/**
				 *  condition
				 */
			},
		],
		questionItems: [
			{
				question: {
					type: ObjectId,
					ref: 'P4Question',
					required: true,
				},
				group: {
					type: ObjectId,
				},
			},
		],
	},
	{ timestamps: true }
);

module.exports = mongoose.model('P4Questionnaire', QuestionnaireSchema);
