import { Document } from 'mongoose';
import { Client } from '../../types/Client';
import { IUser } from '../IUser';

interface Address {
	street1: string;
	street2: string;
	street3: string;
	city: string;
	zipCode: string;
	state: string;
	country: string;
}

interface IUserCompleteDetails extends Document {
	user: IUser;
	client: Client;
	idNo: string;
	studentName: string;
	fatherName: string;
	motherName: string;
	surname: string;
	standerd: string;
	division: string;
	rollNo: string;
	admissionStanderd: string;
	admissionDate: Date;
	DOB: Date;
	gender: 'male' | 'female' | 'other';
	bloodGroup: 'a-' | 'a+' | 'b-' | 'b+' | 'o-' | 'o+' | 'ab-' | 'ab+';
	religion: string;
	cast: string;
	subCast: string;
	castCategory: string;
	parentContact: string;
	parentEmail: string;
	studentContact: string;
	studentEmail: string;
	presentAddress: Address;
	permanentAddress: Address;
	presentContactNo: string;
	emergencyContactNo: string;
	birthPlace: string;
	birthTaluka: string;
	birthDistrict: string;
	birthState: string;
	birthCountry: string;
	house: string;
	motherTongue: string;
	uidNumber: string;
	adhaarNumber: string;
	quota: string;
	sUid: string;
	leftStanderd: string;
	leftDate: Date;
	lcNumber: string;
	lcDate: string;
	lcReason: string;
	lcProgress: string;
	lcConduct: string;
	lcRemark: string;
	previousStanderd: string;
	whatsappContact: string;
}
