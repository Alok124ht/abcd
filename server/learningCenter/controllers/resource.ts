import { NextFunction, Response } from 'express';
import ResourceDocument from '../models/ResourceDocument';
import { Request } from '../../types/Request';
import { getRandomString } from '../../utils/string';
import s3 from '../../aws/s3';

export const createResourceDocument = (req: Request, res: Response) => {
	const { id: userId } = req.payload;
	const { title, description, thumbNailsUrls, tags, endpoints } = req.body;
	const resourceDocument = new ResourceDocument({
		title,
		description,
		thumbNailsUrls,
		tags,
		endpoints,
		createdBy: userId,
	});
	resourceDocument.save((saveError) => {
		if (saveError) {
			res.status(422).send({ message: 'Unable to save', error: saveError });
		} else {
			res.send({ resourceDocument });
		}
	});
};

export const createPolicyForDocument = (req: Request, res: Response) => {
	const { id: userId } = req.payload;
	const { mime, fileName } = req.body;
	const filePath = `${
		process.env.AWS_LEARNING_CENTER_DOCUMENTS_BASE_PATH
	}/u/${userId}/${getRandomString(20)}/${fileName}`;
	return s3.createPresignedPost(
		{
			Bucket: process.env.AWS_LEARNING_CENTER_DOCUMENTS_BUCKET,
			Expires: 3600,
			Conditions: [{ key: filePath }],
			Fields: { acl: 'public-read', key: filePath, mime },
		},
		(error, data) => {
			if (error) {
				res.status(422).send({ message: 'Unable to create policy', error });
			} else {
				res.send({ data, filePath });
			}
		}
	);
};

export const getMyUploads = (req: Request, res: Response) => {
	const { id: userId } = req.payload;
	ResourceDocument.find({ createdBy: userId })
		.sort({ createdAt: -1 })
		.exec((error, items) => {
			if (error) {
				res.status(500).send({ message: 'Internal server error' });
			} else {
				res.send({ items });
			}
		});
};

export const updateResourceDocument = (req: Request, res: Response) => {
	const { id: userId } = req.payload;
	const {
		_id: resourceDocumentId,
		title,
		description,
		tags,
		endpoints,
	} = req.body;
	ResourceDocument.findOne({ createdBy: userId, _id: resourceDocumentId }).exec(
		(searchError, resourceDocument) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else if (!resourceDocument) {
				res.status(404).send({ message: 'Not found' });
			} else {
				resourceDocument.set('tags', tags);
				resourceDocument.set('title', title);
				resourceDocument.set('endpoints', endpoints);
				resourceDocument.description = description;
				resourceDocument.save((error) => {
					if (error) {
						res.status(422).send({ message: 'Invalid data', error });
					} else {
						res.send({ resourceDocument });
					}
				});
			}
		}
	);
};
