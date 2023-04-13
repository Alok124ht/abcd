import { Request } from '../../types/Request';
import { NextFunction, Response } from 'express';
import AWS from 'aws-sdk';
import { getRandomString } from '../../utils/string';

const s3 = new AWS.S3({
	region: process.env.AVATAR_S3_AWS_REGION,
	accessKeyId: process.env.GENERAL_AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.GENERAL_AWS_SECRET_ACCESS_KEY,
});

export async function getUploadPolicy(
	req: Request & { body: { mime: string; fileName: string } },
	res: Response,
	next: NextFunction
) {
	const { id: userId } = req.payload;
	const { mime, fileName } = req.body;
	const filePath = `${
		process.env.AWS_LEARNING_CENTER_DOCUMENTS_BASE_PATH
	}/services/u/${userId}/${getRandomString(25)}/${fileName}`;
	return s3.createPresignedPost(
		{
			Bucket: process.env.AWS_LEARNING_CENTER_DOCUMENTS_BUCKET,
			Expires: 3600,
			Conditions: [{ key: filePath }],
			Fields: { acl: 'public-read', key: filePath, mime, 'content-type': mime },
		},
		(error: Error, data: any) => {
			if (error) {
				res.status(422).send({ message: 'Unable to create policy', error });
			} else {
				res.send({ data, filePath });
			}
		}
	);
}
