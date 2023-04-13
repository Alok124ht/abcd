import { Document, Model, Types } from 'mongoose';
import { TagList } from '../../types/Tag';

interface ActionHookConfig {
	/** Phase in which user will be enrolled */
	phase: Types.ObjectId;
	subGroup: Types.ObjectId;
	superGroup: Types.ObjectId;
	/** Assessment LINK to be sent over email */
	wrapper: Types.ObjectId;
	email: {
		subject: string;
		mainMessage: string;
	};
}

interface Course extends Document {
	title: string;
	/**
	 * Final price
	 */
	price: number;
	/**
	 * Original price
	 */
	originalPrice?: number;
	config: {
		requireGrades: boolean;
		onApplication: ActionHookConfig;
		onPurchase: ActionHookConfig;
	};
	currency: 'INR';
	type: 'course' | 'combo';
	courses: Types.ObjectId[];
	tags: TagList;
	createdAt: Date;
	updatedAt: Date;
}

interface CourseModelInterface extends Model<Course> {}
