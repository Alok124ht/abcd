import { Request } from 'express';
import { Document, Model, MongooseDocument, Types } from 'mongoose';
import { UserAccountDocument } from './types/IUserAccount';

interface Rating {
	assessment: string;
	name: string;
	rating: number;
	assessment_rank: number;
	k: number;
	time_utilization_score: number;
}

interface IConcept {
	id: string;
	total: number;
	correct: number;
}

export const enum UserRole {
	ADMIN = 'admin',
	SUPER = 'super',
	MENTOR = 'mentor',
	MODERATOR = 'moderator',
	USER = 'user',
	HR = 'hr',
	LIBRARIAN = 'librarian',
	HOD = 'hod',
	INVENTORY_MANAGER = 'inventory-manager',
	ACCOUNT_STAFF = 'account-staff',
	EMPLOYEE = 'employee',
	PARENT = 'parent',
}

export const employeeRoles = [
	'employee',
	'moderator',
	'hr',
	'librarian',
	'inventory-manager',
	'mentor',
	'account-staff',
];

interface ISubTopic {
	id: string;
	last_activity: {
		type?: any;
		qid?: string;
		startTime?: string;
	};
	percent_complete: number;
	test_performance?: any;
	questions: any[];
	concepts?: IConcept[];
}

interface ITopic {
	id: string;
	percent_complete: number;
	last_activity: {
		type?: any;
		sub_topic?: string;
	};
	test_performance?: any;
	sub_topics: Array<ISubTopic>;
}

interface Milestone {
	achievement: string;
	key: string;
	date: Date | number;
}

export interface UserSubscription {
	group: string;
	rating?: [
		{
			assessment: string;
			name: string;
			rating: number;
			assessment_rank: number;
			k: number;
			time_utilization_score: number;
		}
	];
	overall_rank?: [
		{
			assessment: string;
			rank: number;
			percentile: number;
			participants: number;
		}
	];
	k?: number;
	subgroups: [
		{
			group: string;
			overall_rank?: [
				{
					assessment: string;
					rank: number;
					percentile: number;
					participants: number;
				}
			];
			active?: boolean;
			phases: [
				{
					phase: Types.ObjectId;
					active: boolean;
					isAccessGranted: boolean;
					revocationReason?: object;
				}
			];
		}
	];
}

interface JeeData {
	studentName: string;
	fatherName: string;
	motherName: string;
	instituteRollNo: string;
	jeeMainsRollNo: string;
	jeeMainsDOB: string;
	jeeMainsMobile: string;
	jeeMainsEmail: string;
	jeeAdvancedRollNo: string;
	jeeAdvancedMobile: string;
	jeeAdvancedEmail: string;
	jeeAdvancedDOB: string;
}

export interface IUser extends Document {
	username: string;
	name: string;
	email: string;
	emailIdentifier: string;
	mobileNumber: string;
	hash: string;
	isVerified: boolean;
	verifiedBy: string;
	role: UserRole;
	phases: Types.ObjectId[];
	type: string;
	salt: string;
	bookmarks: any[];
	stats: {
		topics: Array<ITopic>;
		rating: Array<Rating>;
		daily_activity: any[];
		last_activity: any;
		difficulty: {
			Easy: number;
			Medium: number;
			Hard: number;
		};
		calibrationDate: Date;
	};
	session: any;
	liveAssessment: any;
	streak: {
		date: string;
		day: number;
		todays_count: number;
		todays_correct: number;
	};
	xp: any;
	netXp: {
		xp: Types.ObjectId;
		val: number;
	};
	milestones: Milestone[];
	settings: {
		sharing: boolean;
		goal: { goal: number; date: string }[];
		goalUpdateRequest: {
			goal: number;
			date: Date;
			active: boolean;
		};
	};
	createdAt: Date;
	dp: string;
	thumbnail: string;
	resetPasswordToken: string;
	resetPasswordExpires: Date;
	subscriptions?: UserSubscription[];
	demoStep: number;
	category: Types.ObjectId | MongooseDocument;
	version: number;
	archiveRequest: Date | number;
	isArchived: boolean;
	label: string;
	labelUpdate: Date | number;
	client: Types.ObjectId | MongooseDocument;
	subjects: Types.ObjectId[];
	oldPhases: Types.ObjectId[];
	portal?: string;
	joiningDate: Date;
	jeeData: JeeData;
	children: IUser[];
	setPassword: (this: IUser, password: string) => void;
	validatePassword: (password: string) => boolean;
	getAccount: (this: IUser) => Promise<UserAccountDocument>;
	createAccount: (this: IUser) => Promise<UserAccountDocument>;
	generateJWT: (this: IUser, req: Request) => Promise<string>;
}

export interface IUserModel extends Model<IUser> {
	get(id: Types.ObjectId, projection: any): Promise<IUser>;
	getManyBySubgroups(
		this: IUserModel,
		subgroups: any[],
		projection: any
	): Promise<IUser[]>;
	getManyBySupergroup(this: IUserModel, supergroup: string): Promise<IUser[]>;
	updateGoal(userId: Types.ObjectId, goal: number): Promise<IUser>;
	updateXP(
		user: IUser,
		correct: boolean,
		attempt: Types.ObjectId
	): { xpEarned: number };
	updateStats(
		this: IUserModel,
		user: IUser,
		qid: Types.ObjectId,
		option: string,
		topic: string,
		sub_topic: string,
		difficulty: number,
		session: Types.ObjectId
	): void;
}
