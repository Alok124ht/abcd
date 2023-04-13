import { Model, Document, Types } from 'mongoose';
import { IUser } from '../user/IUser';

interface AnnouncementBase {
	body: string;
	title: string;
	categories: string[];
	files: { url: string; name: string; type: string; extension: string }[];
}

interface AnnouncementDocument extends AnnouncementBase, Document {
	visibleTo: { type: 'Phase'; value: Types.ObjectId }[];
	createdBy: Types.ObjectId | IUser;
}

interface AnnouncementModelInterface extends Model<AnnouncementDocument> {}
