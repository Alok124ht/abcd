const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const PlaylistSettingSchema = new mongoose.Schema(
	{
		label: { type: String, required: true, match: /[a-zA-Z]/ },
		createdBy: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		groupBy: {
			type: String,
			enum: ['Topic', 'Date', 'Newer-by-Date__Older-by-Topic'],
			default: 'Date',
		},
		theme: {
			/**
			 * UI-theme when playlist is shown
			 */
			type: String,
			enum: ['Classic', 'Magic', 'VerticalList'],
			default: 'Classic',
		},
		thumbnailViewTheme: {
			/**
			 * theme when only playlist thumbnail is shown
			 */
			type: String,
			enum: ['Classic', 'EverythingInTheBox'],
			default: 'Classic',
		},
		thumbnailBackgroundColor: {
			type: String,
		},
		isPublic: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model('PlaylistSetting', PlaylistSettingSchema);
