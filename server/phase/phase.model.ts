import moment from 'moment';
import { Types, Schema, model } from 'mongoose';
import { Phase, PhaseModelInterface } from '../types/Phase';

const { ObjectId } = Types;

const PhaseSchema = new Schema(
	{
		name: { type: String, required: true },
		enrollmentStartDate: { type: Date, required: false },
		enrollmentEndDate: { type: Date, required: false },
		startDate: { type: Date, required: true },
		endDate: { type: Date, required: true },
		group: { type: String },
		supergroup: { type: ObjectId, required: true },
		subgroups: [
			{
				subgroup: { type: ObjectId, ref: 'SubGroup' },
			},
		],
		topics: [{ type: String }],
		config: {
			enableForum: Boolean,
			enableAnnouncements: Boolean,
			enableChats: Boolean,
			disablePractice: Boolean,
		},
		fee: {
			// will not be used
			type: Number,
			required: true,
			default: 0,
		},
		topicMocks: { type: Boolean, default: false },
		sectionalMocks: { type: Boolean, default: false },
		fullMocks: { type: Boolean, default: false },
		liveTests: { type: Boolean, default: false },
		series: [{ type: String }],
		course: { type: ObjectId, ref: 'Course' },
		users: { type: Number, default: 0 },
		hidden: { type: Boolean, default: false },
		isPrivate: { type: Boolean, default: false },
		hasCoursePlan: { type: Boolean, default: false },
		/**
		 * infer course plan from videos, assignments (assessments might be added later on)
		 */
		inferCoursePlan: { type: Boolean, default: false },
		externalScheduleLink: { type: String },
		subjects: [{ type: ObjectId, ref: 'Subject' }],
		deviceLimit: {
			/**
			 * device limit -1 or undefined (not set) will mean Infinity
			 * 0 will mean a user will not be able to login
			 */
			type: Number,
			min: [
				-1,
				'Minimum value of Device Limit can be -1, which will mean unlimited',
			],
		},
		forSchool: { type: Boolean, default: false },
		attendanceType: { type: String, default: 'lecture' },
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
		toJSON: { virtuals: true },
	}
);

PhaseSchema.method('isActive', function isActive(this: Phase) {
	const now = Date.now();
	const endMoment = moment(this.endDate);
	const startDate = moment(this.startDate);
	return endMoment.isAfter(now) && startDate.isBefore(now);
});

PhaseSchema.virtual('isOpenForEnrollment').get(function isOpenForEnrollment() {
	const now = Date.now();
	if (this.enrollmentEndDate && now > this.enrollmentEndDate) {
		return false;
	}
	if (this.enrollmentStartDate && now < this.enrollmentStartDate) {
		return false;
	}
	return true;
});

const PhaseModel = model<Phase, PhaseModelInterface>('Phase', PhaseSchema);
export default PhaseModel;
