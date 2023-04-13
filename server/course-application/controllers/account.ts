import { Types } from 'mongoose';
import { isEmpty } from 'lodash';
import { Course } from '../../p4/types/Course';
import UserModel from '../../user/user.model';
import { getStrippedEmail } from '../../utils/user/email';
import CourseApplication from '../../models/CourseApplication';
import { sendEmail } from '../../utils/mail';
import { getDefaultSubscriptionFromPhase } from '../../user/utils/user';
import { getRandomString } from '../../utils/string';

export async function createUserFromApplication(
	applicationId: Types.ObjectId,
	password: string
) {
	const courseApplication = await CourseApplication.findById(
		applicationId
	).populate({
		path: 'course',
		populate: {
			path: 'config.assessmentPhase',
		},
	});
	if (!courseApplication) {
		throw new Error('Invalid course application id');
	}
	if (password !== courseApplication.password) {
		throw new Error('You can not take action on this application');
	}
	const existingUser = await UserModel.findOne({
		emailIdentifier: getStrippedEmail(courseApplication.email),
	});
	const applicationCourse = (courseApplication.course as unknown) as Course;
	const assessmentConfig = applicationCourse.config.onApplication;
	if (!assessmentConfig || isEmpty(assessmentConfig)) {
		throw new Error('This course has no phase');
	} else {
		const phaseId = assessmentConfig.phase;
		const subGroupId = assessmentConfig.subGroup;
		const superGroupId = assessmentConfig.superGroup;

		const emailConfig = assessmentConfig.email;
		if (
			!assessmentConfig.phase ||
			!assessmentConfig.subGroup ||
			!assessmentConfig.superGroup
		) {
			throw new Error('Assessment config not set');
		}
		if (existingUser) {
			const account = await existingUser.getAccount();
			await account.createUserForPhase(superGroupId, subGroupId, phaseId);
			sendEmail(
				{
					to: [courseApplication.email],
					body: emailConfig.mainMessage,
					bodyType: 'text',
					subject: emailConfig.subject,
				},
				() => {}
			);
		} else {
			const { subscriptions, error } = await getDefaultSubscriptionFromPhase(
				superGroupId,
				subGroupId,
				phaseId
			);
			if (error) {
				throw new Error(error);
			}
			const user = new UserModel({
				name: courseApplication.name,
				email: courseApplication.email,
				emailIdentifier: getStrippedEmail(courseApplication.email),
				subscriptions,
				username: getRandomString(15, { onlyAlphabets: true }),
			});
			user.mobileNumber = courseApplication.mobileNumber;
			const userPassword = getRandomString(10);
			user.setPassword(userPassword);
			user.isVerified = true;
			await user.save();
			if (emailConfig && emailConfig.mainMessage && emailConfig.subject) {
				const accountCreationMessage = `Your account has been created and following are the credentials to log in.\nEmail: ${courseApplication.email}\nPassword: ${userPassword}`;
				const emailBody = `${emailConfig.mainMessage}\n\n${accountCreationMessage}`;
				sendEmail(
					{
						to: [courseApplication.email],
						body: emailBody,
						bodyType: 'text',
						subject: emailConfig.subject,
					},
					() => {}
				);
			}
		}
	}
}
