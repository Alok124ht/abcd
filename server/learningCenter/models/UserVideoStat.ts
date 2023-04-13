import { Schema, model } from 'mongoose';
import {
	UserVideoStat,
	UserVideoStatModelInterface,
} from '../../types/UserVideoStat';
import config from '../../../config/config';

const { ObjectId } = Schema.Types;

const UserVideoStatSchema = new Schema(
	{
		v: {
			type: ObjectId,
			ref: 'Video',
			alias: 'video',
			required: true,
			index: true,
		},
		u: {
			type: ObjectId,
			ref: 'User',
			alias: 'user',
			required: true,
			index: true,
		},
		i: {
			alias: 'plays',
			type: [
				{
					from: Date,
					till: Date,
					device: String,
				},
			],
		},
		djl: {
			alias: 'didJoinLive',
			type: Boolean,
		},
		wt: {
			alias: 'watchTime',
			type: Number,
			default: 0,
		},
		iw: {
			alias: 'isWatched',
			type: Boolean,
			default: false,
		},
		lastPosition: {
			type: Number,
		},
		progress: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true }
);

UserVideoStatSchema.pre('save', function preSave(this: UserVideoStat) {
	if (this.watchTime > (config.env === 'development' ? 2 : 5) * 60 * 1000) {
		this.isWatched = true;
	}
});

const UserVideoStat = model<UserVideoStat, UserVideoStatModelInterface>(
	'UserVideoStat',
	UserVideoStatSchema
);

export default UserVideoStat;
