import { S3 } from 'aws-sdk';

const s3 = new S3({
	region: process.env.AVATAR_S3_AWS_REGION,
	accessKeyId: process.env.GENERAL_AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.GENERAL_AWS_SECRET_ACCESS_KEY,
});

export const avatarS3 = new S3({
	region: process.env.AVATAR_S3_AWS_REGION,
	accessKeyId: process.env.AVATAR_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AVATAR_S3_SECRET_ACCESS_KEY,
});

export default s3;
