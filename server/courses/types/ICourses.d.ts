import { Document } from 'mongoose';
import { Client } from '../../types/Client';
import { SubjectDocument } from '../../models/Subject';
import { Phase } from '../../types/Phase';
import { IUser } from '../../user/IUser';

interface ICourses extends Document {
	name: string;
	description: string;
	image: string;
	availableFrom: string;
	availableTill: string;
	availabilitySet: boolean;
	isArchived: boolean;
	createdBy: IUser;
	price: number; //in paisa
	isCourseFree: boolean;
	availableForAll: boolean; // is true then anyone in client can access
	visibleInPhases: Phase[];
	subject: SubjectDocument;
	hiddenFor: IUser[];
	onlyShowTo: IUser[];
	client: Client;
}

export = ICourses;
