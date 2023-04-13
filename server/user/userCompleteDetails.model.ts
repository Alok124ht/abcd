import { model, Schema } from 'mongoose';
import { IUserCompleteDetails } from './types/IUserCompleteDetails';

const {
	Types: { ObjectId },
} = Schema;

const schema = new Schema(
	{
		idNo: String,
		user: { type: ObjectId, ref: 'User' },
		client: { type: ObjectId, ref: 'Client' },
		studentName: String,
		fatherName: String,
		motherName: String,
		surname: String,
		standerd: String,
		division: String,
		rollNo: String,
		admissionStanderd: String,
		admissionDate: Date,
		DOB: Date,
		gender: {
			type: String,
			enum: ['male', 'female', 'other', null, undefined],
		},
		bloodGroup: {
			enum: ['a-', 'a+', 'b-', 'b+', 'o-', 'o+', 'ab-', 'ab+', undefined, null],
		},
		religion: String,
		cast: String,
		subCast: String,
		castCategory: String,
		parentContact: String,
		parentEmail: String,
		studentContact: String,
		studentEmail: String,
		presentAddress: {
			street1: String,
			street2: String,
			street3: String,
			city: String,
			zipCode: String,
			state: String,
			country: String,
		},
		permanentAddress: {
			street1: String,
			street2: String,
			street3: String,
			city: String,
			zipCode: String,
			state: String,
			country: String,
		},
		presentContactNo: String,
		emergencyContactNo: String,
		birthPlace: String,
		birthTaluka: String,
		birthDistrict: String,
		birthState: String,
		birthCountry: String,
		house: String,
		motherTongue: String,
		uidNumber: String,
		adhaarNumber: String,
		quota: String,
		sUid: String,
		leftStanderd: String,
		leftDate: Date,
		lcNumber: String,
		lcDate: String,
		lcReason: String,
		lcProgress: String,
		lcConduct: String,
		lcRemark: String,
		previousStanderd: String,
		whatsappContact: String,
	},
	{ timestamps: true }
);

const UserCompleteDetailsModel = model<IUserCompleteDetails>(
	'UserCompleteDetails',
	schema
);

export = UserCompleteDetailsModel;
