const mongoose = require('mongoose');
const moment = require('moment');
const { forEach, map } = require('lodash');

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const actionsByKey = {
	w: 'watch',
	jl: 'joinLive',
};

const keyForAction = {};
forEach(actionsByKey, (value, key) => {
	keyForAction[value] = key;
});

const actionEnum = map(actionsByKey, (value, key) => key);

const ActivitySchema = {
	a: {
		type: String,
		alias: 'action',
		enum: actionEnum,
		set: (action) => {
			if (keyForAction[action]) {
				return keyForAction[action];
			}
			return action;
		},
		get: (key) => actionsByKey[key],
	},
	at: { type: Date, default: Date.now, alias: 'createdAt' },
	s: { type: Date, alias: 'startedAt' },
	d: { type: Number, alias: 'duration' },
	f: { type: Number, alias: 'from' },
	t: { type: Number, alias: 'till' },
};

const UserVideoActivitySchema = new mongoose.Schema(
	{
		v: {
			type: ObjectId,
			ref: 'Video',
			alias: 'video',
			index: true,
		},
		u: {
			type: ObjectId,
			ref: 'User',
			alias: 'user',
			index: true,
		},
		a: {
			alias: 'activities',
			type: [ActivitySchema],
		},
	},
	{ timestamps: true }
);

UserVideoActivitySchema.method(
	'addActivities',
	function addActivities(activities) {
		forEach(activities, (activity) => {
			this.activities.push(activity);
		});
		this.mergeActivities();
	}
);

const canMerge = (earlierActivity, laterActivity) => {
	if (!earlierActivity) {
		return false;
	}
	const creationDifference = Math.abs(
		moment(earlierActivity.createdAt).diff(laterActivity.createdAt)
	);
	const durationSpent = laterActivity.duration;
	if (creationDifference * 0.9 <= durationSpent) {
		return true;
	}
	return false;
};

const mergeTwoActivities = (earlierActivity, laterActivity) => ({
	action: 'watch',
	createdAt: laterActivity.createdAt,
	duration: earlierActivity.duration + laterActivity.duration,
});

UserVideoActivitySchema.method('mergeActivities', function mergeActivities() {
	const originalActivities = this.activities;
	const mergedActivities = [];
	originalActivities.forEach((activity) => {
		const prevItem = mergedActivities[mergedActivities.length - 1];
		if (canMerge(prevItem, activity)) {
			const mergedActivity = mergeTwoActivities(prevItem, activity);
			mergedActivities[mergedActivities.length - 1] = mergedActivity;
		} else {
			mergedActivities.push(activity);
		}
	});
	this.activities = mergedActivities;
});

module.exports = mongoose.model('UserVideoActivity', UserVideoActivitySchema);
