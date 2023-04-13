import { Document, Model, Types } from 'mongoose';
interface SuperGroup extends Document {
	name: string;
	defaultSubgroup: Types.ObjectId;
	subgroups: { subgroup: Types.ObjectId }[];
	isPremium: boolean;
	isVisible: boolean;
	isPrivate: boolean;
	isCollegeRequired: boolean;
	leaderboard: {
		assessmentId: string;
		assessment_toppers: { user: Types.ObjectId; rating: number; marks: number }[];
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
interface SuperGroupModelInterface extends Model<SuperGroup> {
	list(populate: any): Promise<SuperGroup[]>;
	listLite(): Promise<SuperGroup[]>;
	listOne(
		superGroupId: Types.ObjectId
	): Promise<{ group?: SuperGroup; success: boolean }>;
	listSubgroupUsers(): Promise<SuperGroup[]>;
	get(id: string | Types.ObjectId, projection?: {}): Promise<SuperGroup>;
	getNames(): Promise<{ [superGroupId: string]: string }>;
	getOneByName(name: string, populate: any): Promise<SuperGroup>;
}
