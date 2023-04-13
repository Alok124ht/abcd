import { Types } from 'mongoose';

interface AdminPermissionResponseLocal {
	phases: Types.ObjectId[];
	users: Types.ObjectId[];
	userGroups: Types.ObjectId[];
	usersOfUserGroups: Types.ObjectId[];
}

export default AdminPermissionResponseLocal;
