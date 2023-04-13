import { Document, Model, Types } from 'mongoose';

interface ScheduledLecture extends Document {
	/**
	 * Optional Label for the class
	 */
	label?: string;
	lecturer: Types.ObjectId;
	subject: Types.ObjectId;
	phases: Types.ObjectId[];
	/**
	 * Date and time at which lecture starts
	 */
	startTime: Date;
	/**
	 * Date and time at which lecture ends
	 */
	endTime: Date;
	createdBy: Types.ObjectId;
	createdAt?: Date;
	updatedAt?: Date;
}
interface ScheduledLectureModelInterface extends Model<ScheduledLecture> {}
