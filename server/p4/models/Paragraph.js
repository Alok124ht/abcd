const mongoose = require('mongoose');
const ContentSchema = require('./Content.schema');

const Schema = mongoose.Schema;

const ParagraphSchema = new Schema(
	{
		content: ContentSchema,
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model('P4Paragraph', ParagraphSchema);
