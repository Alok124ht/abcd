import { Response } from 'express';
import { Request } from '../../types/Request';
import { getRandomString } from '../../utils/string';
import s3 from '../../aws/s3';

export const getUploadPolicy = (req: Request, res: Response) => {
	const { id: userId } = req.payload;
	const { mime, fileName } = req.body;
	const filePath = `${
		process.env.AWS_LEARNING_CENTER_DOCUMENTS_BASE_PATH
	}/annoucements/u/${userId}/${getRandomString(24)}/${fileName}`;
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
};
