import { Types, Schema, model } from 'mongoose';
import { SubGroup, SubGroupModelInterface } from '../types/SubGroup';

const { ObjectId } = Schema.Types;

const SubGroupSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
		},
		topics: [
			{
				topic: String,
			},
		],
		users: {
			type: Number,
			required: true,
			default: 0,
		},
		supergroup: {
			// if superset is same as id, it's topmost category. show this as 'Others'
			// superset should contain all the topics of subsets
			type: String,
			required: true,
		},
		phases: [
			{
				phase: {
					type: ObjectId,
					ref: 'Phase',
				},
			},
		],
		isPrivate: { type: Boolean, default: false },
		isCollegeRequired: {
			type: Boolean,
			default: false,
		},
		leaderboard: [
			// get it out of subgroup. create new ...
			{
				// new addition!!
				assessmentId: String,
				assessment_toppers: [
					{
						user: {
							type: ObjectId,
							ref: 'User',
						},
						// username: String,
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
					default: Array(30).fill(0), // 0-100, 100-200, 200-300, ..., 2800-2900, 2900-3000
				},
			},
		],
	},
	{
		timestamps: true,
		usePushEach: true,
	}
);

SubGroupSchema.statics = {
	async nameMapAndPhases(
		this: SubGroupModelInterface,
		supergroup: string,
		subgroupId: string
	) {
		const groups = await this.find(
			{ supergroup },
			{ name: 1, isCollegeRequired: 1 }
		)
			.populate([{ path: 'phases.phase', select: 'startDate endDate isPrivate' }])
			.exec();
		const nameMap: { [groupId: string]: string } = {};
		const phases: { phase: Types.ObjectId }[] = [];
		groups.forEach((group) => {
			nameMap[group._id.toString()] = group.name;
			if (group._id.equals(subgroupId)) {
				phases.push(...group.phases);
			}
		});
		return await Promise.resolve({ nameMap, phases });
	},
};

const SubGroupModel = model<SubGroup, SubGroupModelInterface>(
	'SubGroup',
	SubGroupSchema
);

export default SubGroupModel;
