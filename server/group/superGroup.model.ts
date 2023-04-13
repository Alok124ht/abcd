import { Schema, model, Types } from 'mongoose';
import { SuperGroup, SuperGroupModelInterface } from '../types/SuperGroup';
import logger from '../../config/winston';

const { ObjectId } = Schema.Types;

const SuperGroupSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
			unique: true,
		},
		defaultSubgroup: {
			type: ObjectId,
			ref: 'SubGroup',
		},
		subgroups: [
			{
				subgroup: {
					type: ObjectId,
					ref: 'SubGroup',
				},
			},
		],
		isPremium: {
			type: Boolean,
			default: false,
			required: true,
		},
		isVisible: {
			type: Boolean,
			default: true,
		},
		leaderboard: [
			{
				assessmentId: String,
				assessment_toppers: [
					{
						user: {
							type: ObjectId,
							ref: 'User',
						},
						// username: String, //not used now
						rating: Number,
						marks: Number,
					},
				],
				overall_toppers: [
					{
						user: {
							type: ObjectId,
							ref: 'User',
						},
						// username: String,
						rating: Number,
						del_rating: Number,
					},
				],
				sum_rating: Number,
				tot_rating: Number,
				hist: {
					type: Array,
					default: Array(30).fill(0),
					// 0-100, 100-200, 200-300, ..., 2800-2900, 2900-3000
					// 0-1250, 1250-1275, 1275-1300, ..., 1925-1950, 1950-infinity
				},
			},
		],
		isCollegeRequired: {
			type: Boolean,
			default: false,
		},
		topicMocks: {
			// no longer needed
			type: Boolean,
			default: false,
		},
		sectionalMocks: {
			type: Boolean,
			default: false,
		},
		fullMocks: {
			type: Boolean,
			default: false,
		},
		liveTests: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

SuperGroupSchema.statics = {
	async list(this: SuperGroupModelInterface, populate: any) {
		if (populate) {
			const groups = await this.find({})
				.populate([
					{ path: 'leaderboard.assessment_toppers.user', select: 'dp username' },
					{ path: 'leaderboard.overall_toppers.user', select: 'dp username' },
					{
						path: 'subgroups.subgroup',
						populate: [
							{ path: 'leaderboard.assessment_toppers.user', select: 'dp username' },
							{ path: 'leaderboard.overall_toppers.user', select: 'dp username' },
						],
					},
				])
				.exec();
			return groups;
		}
		const groups_1 = await this.find({}).populate('subgroups.subgroup').exec();
		return groups_1;
	},

	async listLite(this: SuperGroupModelInterface) {
		const groups = await this.find({}, { name: 1, subgroups: 1 })
			.populate([
				{ path: 'subgroups.subgroup', select: 'name phases users topics' },
			])
			.exec();
		return groups;
	},

	async listOne(
		this: SuperGroupModelInterface,
		superGroupId: Types.ObjectId
	): Promise<{ group?: SuperGroup; success: boolean }> {
		try {
			const group = await this.findOne(
				{ _id: superGroupId },
				{
					// subgroups: 0,
					topicMocks: 0,
					sectionalMocks: 0,
					fullMocks: 0,
					liveTests: 0,
					isCollegeRequired: 0,
					defaultSubgroup: 0,
				}
			)
				.populate([{ path: 'subgroups.subgroup', select: 'name' }])
				.exec();
			return await Promise.resolve({ group, success: true });
		} catch (err) {
			logger.info('Error occurred in listOne superGroup', err.message);
			return await Promise.resolve({ success: false, message: err.message });
		}
	},

	async listSubgroupUsers(this: SuperGroupModelInterface) {
		const groups = await this.find({}, { subgroups: 1 })
			.populate([{ path: 'subgroups.subgroup', select: 'users' }])
			.exec();
		return groups;
	},

	async get(
		this: SuperGroupModelInterface,
		id: string | Types.ObjectId,
		projection = {}
	) {
		const group = await this.findOne({ _id: id }, projection).exec();
		return group;
	},

	async getNames(this: SuperGroupModelInterface) {
		const groups = await this.find({}, { name: 1 }).exec();
		const names: { [superGroupId: string]: string } = {};
		groups.forEach((g) => {
			names[g._id.toString()] = g.name;
		});
		return names;
	},

	async getOneByName(
		this: SuperGroupModelInterface,
		name: string,
		populate: any
	) {
		return this.findOne({ name }, { subgroups: 1, name: 1 })
			.populate(populate)
			.exec();
	},
};

const SuperGroupModel = model<SuperGroup, SuperGroupModelInterface>(
	'SuperGroup',
	SuperGroupSchema
);
export default SuperGroupModel;
