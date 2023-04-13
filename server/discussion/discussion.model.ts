import { Document, Model, Types, Schema, model } from 'mongoose';
import { IUser } from '../user/IUser';

const { ObjectId } = Schema.Types;

export interface SubThreadItem {
	_id: Types.ObjectId;
	text: string;
	user: Types.ObjectId;
	createdAt: Date;
	isDeleted: boolean;
}

export interface ThreadItem extends SubThreadItem {
	_id: Types.ObjectId;
	kind: number;
	upvotes: any[];
	downvotes: any[];
	threads: SubThreadItem[];
}

interface DiscussionBase {
	threads: ThreadItem[];
}

export interface DiscussionDocument extends Document, DiscussionBase {
	/**
	 *  ID of item
	 */
	item: Types.ObjectId;
}

interface DiscussionModelInterface extends Model<DiscussionDocument> {
	getByQIDs(
		this: DiscussionModelInterface,
		id: string | Types.ObjectId
	): Promise<any>;
	getByQID(
		this: DiscussionModelInterface,
		id: string | Types.ObjectId
	): Promise<DiscussionDocument>;
	getByTID(
		this: DiscussionModelInterface,
		threadId: string | Types.ObjectId
	): Promise<DiscussionDocument>;
}

const DiscussionSchema = new Schema(
	{
		id: {
			type: String,
			required: true,
			unique: true,
		},
		threads: [
			{
				kind: {
					type: Number,
					default: 1, // 1=comment, 2=solution, 3=error
				},
				text: {
					type: String,
					default: '',
				},
				user: {
					// this is username
					type: ObjectId, // ObjectId??
					ref: 'User',
					required: true,
				},
				createdAt: {
					// updatedAt??
					type: Date,
					default: Date.now,
				},
				upvotes: {
					type: Array,
					default: [],
				},
				downvotes: {
					type: Array,
					default: [],
				},
				isDeleted: {
					type: Boolean,
					default: false,
				},
				threads: [
					{
						user: {
							// this is username
							type: ObjectId,
							ref: 'User',
							required: true,
						},
						text: {
							type: String,
							default: '',
						},
						isDeleted: {
							type: Boolean,
							default: false,
						},
						createdAt: {
							type: Date,
							default: Date.now,
						},
					},
				],
			},
		],
		createdAt: {
			type: Date,
			default: Date.now,
		},
	},
	{ usePushEach: true }
);

function secureDiscussion(discussion: DiscussionDocument) {
	const securedDiscussion: any = {};
	securedDiscussion._id = discussion._id;
	securedDiscussion.id = discussion.id;
	securedDiscussion.threads = discussion.threads.map((t) => {
		const user = (t.user as unknown) as IUser;
		return {
			_id: t._id,
			kind: t.kind,
			text: t.text,
			upvotes: t.upvotes,
			downvotes: t.downvotes,
			user: {
				dp: user.dp,
				username: user.username,
			},
			threads: t.threads.map((tt) => {
				const subThreadUser = (tt.user as unknown) as IUser;
				return {
					_id: tt._id,
					text: tt.text,
					user: {
						dp: subThreadUser.dp,
						username: subThreadUser.username,
					},
				};
			}),
		};
	});
	return securedDiscussion;
}

DiscussionSchema.statics = {
	async getByQIDs(this: DiscussionModelInterface, id: string | Types.ObjectId) {
		// replace AID by ID. later on add- practice / assessment!
		const discussion = await this.findOne({ id })
			.populate({
				path: 'threads.user',
				select: 'username dp',
			})
			.populate({
				path: 'threads.threads.user',
				select: 'username dp',
			})
			.exec();
		if (discussion) return Promise.resolve(secureDiscussion(discussion));
		return await Promise.resolve(discussion);
	},

	async getByQID(this: DiscussionModelInterface, id: string | Types.ObjectId) {
		// replace AID by ID. later on add- practice / assessment!
		return await this.findOne({ id })
			.populate({
				path: 'threads.user',
				select: 'username dp',
			})
			.populate({
				path: 'threads.threads.user',
				select: 'username dp',
			})
			.exec();
	},

	async getByTID(
		this: DiscussionModelInterface,
		threadId: string | Types.ObjectId
	) {
		return await this.findOne({ 'threads._id': threadId })
			.populate({
				path: 'threads.user',
				select: 'username dp',
			})
			.populate({
				path: 'threads.threads.user',
				select: 'username dp',
			})
			.exec();
	},
};

const DiscussionModel = model<DiscussionDocument, DiscussionModelInterface>(
	'Discussion',
	DiscussionSchema
);
export default DiscussionModel;
