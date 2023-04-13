import Joi from 'joi';
import { getStrippedEmail } from '../../utils/user/email';
import VaccineUserModel from '../models/VaccineUser';

const schema = Joi.object()
	.keys({
		email: Joi.string().email().optional(),
		mobileNumber: Joi.string().length(10),
	})
	.or('email', 'mobileNumber');

export async function getOrRegisterUser(rawUser: any) {
	const email = rawUser.email;
	const mobileNumber = rawUser.mobileNumber;
	const { error } = schema.validate({ email, mobileNumber });
	if (error) {
		throw new Error(error.message);
	}

	const emailIdentifier = getStrippedEmail(rawUser.email);
	const query = {
		$or: [{ emailIdentifier }, { mobileNumber: rawUser.mobileNumber }],
	};
	const count = await VaccineUserModel.countDocuments(query);
	if (count > 0) {
		return await VaccineUserModel.findOne(query);
	}
	await VaccineUserModel.count({});
	const newVaccineUser = new VaccineUserModel();
	newVaccineUser.email = email;
	newVaccineUser.emailIdentifier = emailIdentifier;
	newVaccineUser.name = rawUser.name;
	newVaccineUser.mobileNumber = rawUser.mobileNumber;
	return await newVaccineUser.save();
}
