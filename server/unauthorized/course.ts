import { Request } from '../types/Request';
import moment from 'moment';
import { get } from 'lodash';
import AWS from 'aws-sdk';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { NextFunction, Response } from 'express';
import CourseApplication, {
	ApplicationState,
} from '../models/CourseApplication';
import User from '../user/user.model';
import { getStrippedEmail } from '../utils/user/email';
import logger from '../../config/winston';
import APIError from '../helpers/APIError';
import config from '../../config/config';
import { sendEmail } from '../utils/mail';
import CourseQuery from '../models/CourseQuery';
import { getRandomString } from '../utils/string';
import { parseAsFloat } from '../utils/query';
import { createUserFromApplication } from '../course-application/controllers/account';
import CourseModel from '../p4/models/Course';

const s3 = new AWS.S3({
	region: process.env.AVATAR_S3_AWS_REGION,
	accessKeyId: process.env.AVATAR_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AVATAR_S3_SECRET_ACCESS_KEY,
});

const getFilename = () => {
	function makeid(length: number) {
		let result = '';
		const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
		const charactersLength = characters.length;
		for (let i = 0; i < length; i += 1) {
			if (i % 5 === 4 && i !== length - 1) {
				result += '-';
			} else {
				result += characters.charAt(Math.floor(Math.random() * charactersLength));
			}
		}
		return result;
	}
	return makeid(20);
};
const getFileExtension = (mime: string) => {
	const probableExtension = mime.split('application/')[1] || 'pdf';
	return probableExtension;
};

export async function getCVUploadPolicy(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { ip } = req;
	logger.info(`getImageUploadPolicy called from ip: ${ip}`);
	const uuid = uuidv4();

	const { mime } = req.query;
	if (typeof mime !== 'string') {
		next(new APIError('mime not found', 422, true));
		return;
	}
	const fileExtension = getFileExtension(mime);
	const filePath = `course-application/${
		config.env
	}/${uuid}-${getFilename()}.${fileExtension}`;
	return s3.createPresignedPost(
		{
			Bucket: process.env.AVATAR_S3_BUCKET,
			Expires: 3600,
			Conditions: [{ key: filePath }],
			Fields: Object.assign({
				acl: 'public-read',
				key: filePath,
				'Content-Type': mime,
				'Cache-Control': 'max-age=32000000',
				mime,
			}),
		},
		(error, data) => {
			if (error) {
				res.status(422).send({ message: 'Unable to create policy', error });
			} else {
				res.send({ data, filePath });
			}
		}
	);
}

const courseApplicationJoiSchema = Joi.object({
	name: Joi.string().required().min(3),
	email: Joi.string().required().email(),
	mobileNumber: Joi.string().required().min(10).max(15),
	collegeName: Joi.string().required().min(3, 'utf8'),
	graduationYear: Joi.number().required().min(2000).max(2024),
	experienceYears: Joi.number().integer().min(0),
	paymentMethod: Joi.string().required().valid('prepaid', 'postpaid', 'monthly'),
	cvUrl: Joi.string()
		.required()
		.uri({ scheme: ['https'] }),
}).unknown(true);

export async function applyForCourse(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const {
		name,
		email,
		mobileNumber,
		experienceYears,
		cvUrl,
		graduationYear,
		collegeName,
		paymentMethod,
		course,
	} = req.body;

	const { error } = courseApplicationJoiSchema.validate(req.body);
	const submittedBy = req.payload ? req.payload.id : null;
	if (error) {
		res.status(422).send({
			message: error.message,
			details: error.details,
		});
	} else {
		const user = await User.findOne({
			emailIdentifier: getStrippedEmail(req.body.email),
		}).select('_id');
		const application = new CourseApplication({
			name,
			email,
			mobileNumber,
			experienceYears,
			cvUrl,
			graduationYear,
			collegeName,
			course,
			submittedBy,
			userIp: req.ip,
			user: user ? user._id : null,
			paymentMethod,
		});

		application.save((saveError) => {
			if (saveError) {
				next(new APIError('Unknown error', 500, true));
				sendEmail({
					subject: 'Failed to save course application',
					to: ['amit@prepleaf.com'],
					body: `Name: ${name}\nEmail: ${email}\n Mobile Number: ${mobileNumber}\nGraduation Year: ${graduationYear}\nExperience in Years: ${experienceYears}\nCV: ${cvUrl}`,
					bodyType: 'text',
				});
			} else {
				res.send({ message: 'Application Saved.' });
				sendEmail(
					{
						subject: 'Received application for Analytics and Data Science',
						to: ['aman@prepleaf.com', 'amit@prepleaf.com'],
						body: `Name: ${name}\nEmail: ${email}\nMobile Number: ${mobileNumber}\nPreferred Payment Mode: ${paymentMethod}\nGraduation Year: ${graduationYear}\nExperience in Years: ${experienceYears}\nCV: ${cvUrl}`,
						bodyType: 'text',
					},
					() => {}
				);
			}
		});
	}
}

const courseApplicationBasicDetailJoiSchema = Joi.object({
	name: Joi.string().required().min(3),
	email: Joi.string().required().email(),
	mobileNumber: Joi.string().required().min(10).max(15),
	collegeName: Joi.string().required().min(3, 'utf8'),
}).unknown(true);
const courseApplicationStep2JoiSchema = Joi.object({
	graduationYear: Joi.number().required().min(2000).max(2026),
	experienceYears: Joi.number().integer().min(0),
	paymentMethod: Joi.string().required().valid('prepaid', 'postpaid', 'monthly'),
	cvUrl: Joi.string()
		.required()
		.uri({ scheme: ['https'] }),
	grades: Joi.number(),
}).unknown(true);

export async function submitBasicDetails(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const {
		name,
		email,
		mobileNumber,
		collegeName,
		paymentMethod,
		course,
	} = req.body;

	const { error } = courseApplicationBasicDetailJoiSchema.validate(req.body);
	const submittedBy = req.payload ? req.payload.id : null;
	if (error) {
		res.status(422).send({
			message: error.message,
			details: error.details,
		});
	} else {
		const user = await User.findOne({
			emailIdentifier: getStrippedEmail(req.body.email),
		}).select('_id');
		const application = new CourseApplication({
			name,
			email,
			mobileNumber,
			collegeName,
			submittedBy,
			course,
			paymentMethod,
			userIp: req.ip,
			user: user ? user._id : null,
			password: getRandomString(30),
			state: ApplicationState.applyStep1Completed,
		});

		application.save((saveError) => {
			if (saveError) {
				next(new APIError(saveError, 500, true));
			} else {
				res.send({
					message: 'Basic details for application received.',
					...application.toObject(),
				});
			}
		});
	}
}

export async function submitStep2Details(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const {
		applicationId,
		password,
		experienceYears,
		cvUrl,
		graduationYear,
		collegeName,
		paymentMethod,
		experiences,
	} = req.body;
	const grades = parseAsFloat(req.body.grades, null);
	const { error } = courseApplicationStep2JoiSchema.validate(req.body);
	if (error) {
		res.status(422).send({
			message: error.message,
			details: error.details,
		});
	} else {
		try {
			const application = await CourseApplication.findById(applicationId).populate(
				'course',
				'config'
			);
			if (!application || application.password !== password) {
				next(
					new APIError(
						'Either application not found or password did not match.',
						422,
						true
					)
				);
				return;
			}
			application.experienceYears = experienceYears;
			application.cvUrl = cvUrl;
			application.graduationYear = graduationYear;
			if (collegeName) {
				application.collegeName = collegeName;
			}
			application.paymentMethod = paymentMethod;

			application.userIp = req.ip;
			application.stateHistory.push({
				state: application.state || ApplicationState.applied,
				createdAt: new Date(),
			});
			application.state = ApplicationState.applied;
			const areGradesRequired = get(application, [
				'course',
				'config',
				'requireGrades',
			]);
			if (areGradesRequired) {
				if (grades === null) {
					res.status(422).send({ message: 'Grades are required' });
					return;
				}
				application.grades = grades;
			}

			if (experiences) {
				application.experiences = experiences;
			}

			application.save((saveError) => {
				if (saveError) {
					console.error(saveError);
					next(new APIError(saveError, 500, true));
				} else {
					res.send({
						message: 'Application received.',
						applicationId: application._id,
						password: application.password,
					});
					try {
						if (
							!application.state ||
							[
								ApplicationState.applied,
								ApplicationState.applyStep1Completed,
							].includes(application.state)
						) {
							createUserFromApplication(application._id, application.password)
								.then(() => {
									application.stateHistory.push({
										state: application.state || ApplicationState.applied,
										createdAt: new Date(),
									});
									application.state = ApplicationState.assignmentSent;
									application.save();
								})
								.catch(() => {
									/**
									 * Nothing to be done here
									 */
								});
						}
					} catch (e) {
						console.error(e);
					}
				}
			});
		} catch (e) {
			next(new APIError(e, 522, false));
		}
	}
}

export async function getBasicDetails(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { applicationId, password } = req.query;

	try {
		const application = await CourseApplication.findById(applicationId);
		if (!application || application.password !== password) {
			next(
				new APIError(
					'Either application not found or password did not match.',
					422,
					true
				)
			);
			return;
		}
		res.send({ application });
	} catch (e) {
		next(new APIError(e, 522, false));
	}
}

const courseQuerySchema = Joi.object({
	name: Joi.string().required().min(3),
	email: Joi.string().email(),
	mobileNumber: Joi.string().min(10).max(15),
}).unknown(true);

export async function addCouseQueryDetails(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { error } = courseQuerySchema.validate(req.body);
	if (error) {
		res.status(422).send({
			message: error.message,
			details: error.details,
		});
	} else {
		const course = await CourseModel.findOne({ _id: req.body.course });
		const courseQuery = new CourseQuery({
			name: req.body.name,
			email: req.body.email,
			mobileNumber: req.body.mobileNumber,
			userIp: req.ip,
			course: req.body.course,
		});
		const previousQueries = await CourseQuery.find({
			mobileNumber: req.body.mobileNumber,
		}).sort({ createdAt: -1 });
		const previousQueriesCount = previousQueries.length;
		const lastQueryDate = moment(get(previousQueries, [0, 'createdat'])).format(
			'DD MMM YYYY'
		);
		const prevQueryMessage = previousQueriesCount
			? `This user has requested callback earlier ${previousQueriesCount} time${
					previousQueriesCount > 1 ? 's' : ''
			  }. Last request was recevied at ${lastQueryDate}.`
			: '';
		const courseName = get(course, 'title', 'Unknown course');
		const body = `
			<div style='font-size:1.2rem;text-align:left;'>
			<div style='margin-bottom: 4px;'>${prevQueryMessage}</div>
  <div style='margin-bottom: 4px;'>Name: ${req.body.name}</div>
<div style='margin-bottom: 4px;'>Mobile: <a href='tel:+91${req.body.mobileNumber}'>${req.body.mobileNumber}</a></div>
<div  style='margin-bottom: 4px;'>Course: ${courseName}</div>
<div style='margin-bottom:4px'>
  <a style='display:inline-block;background-color: #1a73e8;color:white;padding: 12px 32px;text-decoration: none;border-radius: 4px;font-size: 1.2rem;font-family: Robot, sans-serif;min-width:200px;text-align: center' href='tel:+91${req.body.mobileNumber}'>Call Now</a>
</div>
</div>
		`;
		courseQuery.save((saveError) => {
			if (saveError) {
				next(saveError);
			} else {
				res.send({ message: 'We have received your request' });
				sendEmail(
					{
						subject: `Callback request received for Course`,
						to:
							config.env === 'production'
								? ['aman@prepleaf.com', 'randhir@prepleaf.com']
								: ['amit@prepleaf.com'],
						body: body,
						bodyType: 'html',
					},
					() => {}
				);
			}
		});
	}
}
