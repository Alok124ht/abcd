import { Document, Model, Types } from 'mongoose';

interface SubGroup extends Document {
	name: string;
	topics: string[];
	users: number;
	supergroup: string;
	phases: { phase: Types.ObjectId }[];
	isPrivate: boolean;
	isCollegeRequired: boolean;
	leaderboard: {
		assessmentId: string;
		assessment_toppers: {
			user: Types.ObjectId;
			rating: number;
			marks: number;
		}[];
		overall_toppers: {
			user: Types.ObjectId;
			rating: number;
			del_rating: number;
		}[];
		sum_rating: number;
		tot_rating: number;
		hist: number[];
	}[];
	createdAt: Date;
	updatedAt: Date;
}

interface SubGroupModelInterface extends Model<SubGroup> {
	nameMapAndPhases(
		this: SubGroupModelInterface,
		supergroup: string,
		subgroupId: string
	): Promise<{
		nameMap: {
			[groupId: string]: string;
		};
		phases: {
			phase: Types.ObjectId;
		}[];
	}>;
}
