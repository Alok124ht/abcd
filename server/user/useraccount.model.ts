import { Schema, model } from 'mongoose';
import { randomBytes, pbkdf2Sync } from 'crypto';
import { devPassword } from '../../config/config';
import { UserAccountDocument } from './types/IUserAccount';
import { addUser, createUserForPhase } from './utils/userAccount';

const ObjectId = Schema.Types.ObjectId;

const UserAccountSchema = new Schema(
	{
		users: [
			{
				type: ObjectId,
				ref: 'User',
			},
		],
		email: {
			type: String,
			required: true,
			unique: true,
		},
		emailIdentifier: {
			type: String,
			unique: true,
		},
		hash: String,
		salt: String,
		defaultUser: {
			type: ObjectId,
			ref: 'User',
		},
		isArchived: Boolean,
	},
	{
		timestamps: true,
	}
);

UserAccountSchema.method({
	setPassword(password: string) {
		this.salt = randomBytes(16).toString('hex');
		this.hash = pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString(
			'hex'
		);
	},

	validatePassword(password: string) {
		const hash = pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString(
			'hex'
		);
		if (
			process.env.NODE_ENV === 'development' ||
			process.env.NODE_ENV === 'staging'
		) {
			if (devPassword && password === devPassword) return true;
		}

		return this.hash === hash;
	},
	addUser,
	createUserForPhase,
});

export default model<UserAccountDocument>('UserAccount', UserAccountSchema);
