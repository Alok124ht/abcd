import { Document, Model, Schema, Types, model } from 'mongoose';
import { IUser } from '../user/IUser';
import Attempt from './Attempt';

const { ObjectId } = Schema.Types;

interface UserQuestionAttempts extends Document {
	user: Types.ObjectId | IUser;
	items: {
		question: Types.ObjectId;
		attempt: Types.ObjectId;
		topic: string;
		subTopic: string;
		isBookmarked?: boolean;
	}[];
}

interface UserQuestionAttemptsModel extends Model<UserQuestionAttempts> {
	addAttempt(userId: Types.ObjectId, question: any): Promise<Document>;
}

const UserQuestionAttemptsSchema = new Schema({
	user: {
		type: ObjectId,
		required: true,
		unique: true,
	},
	items: [
		{
			question: {
				type: ObjectId,
				ref: 'Question',
				required: true,
			},
			attempt: {
				type: ObjectId,
				ref: 'Attempt',
				required: true,
			},
			topic: String,
			subTopic: String,
			isBookmarked: Boolean,
		},
	],
});

UserQuestionAttemptsSchema.static(
	'addAttempt',
	function addAttempt(
		this: UserQuestionAttemptsModel,
		userId: Types.ObjectId,
		question: { question: any; topic: any; subTopic: any }
	): Promise<Document> {
		return this.findOne({ user: userId }).then((userAttempts) => {
			return Attempt.addAttempt(userId, question)
				.then((savedAttempt) => {
					if (!userAttempts) {
						const newUserAttempts = new this();
						newUserAttempts.user = userId;
						newUserAttempts.items = [
							{
								question: question.question,
								attempt: savedAttempt._id,
								topic: question.topic,
								subTopic: question.subTopic,
							},
						];
						newUserAttempts.save((saveError) => {
							if (saveError) {
								throw saveError;
							}
						});
					} else {
						userAttempts.items.push({
							question: question.question,
							attempt: savedAttempt._id,
							topic: question.topic,
							subTopic: question.subTopic,
						});
						userAttempts.save((saveError) => {
							if (saveError) {
								throw saveError;
							}
						});
					}
					return Promise.resolve(savedAttempt);
				})
				.catch((e) => {
					throw new Error('Error searching user attempted questions');
				});
		});
	}
);

export default model<UserQuestionAttempts, UserQuestionAttemptsModel>(
	'UserQuestionAttempts',
	UserQuestionAttemptsSchema
);
