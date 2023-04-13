import { Document, Model, Types } from 'mongoose';

declare enum AttendanceType {
	lecture = 'lecture',
	daily = 'daily',
}
interface Phase extends Document {
	name: string;
	enrollmentStartDate: Date;
	enrollmentEndDate: Date;
	startDate: Date;
	endDate: Date;
	/**
	 * To group phases, only for UI purpose
	 */
	group?: string;
	supergroup: Types.ObjectId;
	subgroups: { subgroup: Types.ObjectId }[];
	topics: string[];
	config: {
		enableForum: boolean;
		enableAnnouncements: boolean;
		enableChats: boolean;
		disablePractice: boolean;
	};
	topicMocks: boolean;
	sectionalMocks: boolean;
	fullMocks: boolean;
	liveTests: boolean;
	series: string[];
	course: Types.ObjectId;
	users: number;
	hidden: boolean;
	isPrivate: boolean;
	isCollegeRequired: boolean;
	hasCoursePlan: boolean;
	inferCoursePlan: boolean;
	externalScheduleLink: string;
	subjects: Types.ObjectId[];
	deviceLimit: number;
	attendanceType: AttendanceType;
	forSchool: boolean;
	createdAt: Date;
	updatedAt: Date;
}
interface PhaseModelInterface extends Model<Phase> {}
