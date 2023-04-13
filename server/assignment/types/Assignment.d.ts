import { Model, Types } from 'mongoose';
import {
	ResourceBase,
	ResourceBaseDocument,
	ResourceBaseStatics,
} from '../../learningCenter/models/ResourceBaseSchema';

export interface Permission {
	item: Types.ObjectId;
	itemType: 'UserGroup' | 'User';
}

interface Assignment extends ResourceBase {
	files: { url: string; name: string }[];
	submissionDeadline?: Date;
	permissions: Permission[];
	markingScheme: {
		sections: [
			{
				_id: Types.ObjectId;
				name: string;
				maxMarks: number;
			}
		];
	};
}

export interface AssignmentDocument extends ResourceBaseDocument, Assignment {
	makeForPublic(options: {
		withEndpoints: boolean;
		hasAccessToContent: boolean;
	}): object;
	maxMarks: number;
}

export interface AssignmentModel
	extends Model<AssignmentDocument>,
		ResourceBaseStatics {}
