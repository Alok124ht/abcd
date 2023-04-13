import { Response } from 'express';
import ResourceDocument from '../models/ResourceDocument';
import { Request } from '../../types/Request';
import { getRandomString } from '../../utils/string';
import s3 from '../../aws/s3';
import { getAllMentorAndModeratorsIds } from '../../client/client.controller';
import { forEach, toString } from 'lodash';
import PlaylistModel from '../models/Playlist';

export const createResourceDocument = (req: Request, res: Response) => {
	const { id: userId } = req.payload;
	const { title, description, thumbNailsUrls, tags, endpoints, type } = req.body;
	const resourceDocument = new ResourceDocument({
		title,
		description,
		thumbNailsUrls,
		tags,
		endpoints,
		createdBy: userId,
		type,
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

export const getMyUploads = async (req: Request, res: Response) => {
	const { id: userId, role } = req.payload;
	let query: any = {};
	let createdBy = [];
	if (role === 'moderator' || role === 'mentor') {
		createdBy.push(userId);
		if (role === 'moderator') {
			const users = await getAllMentorAndModeratorsIds(userId);
			createdBy = [...createdBy, ...users];
		}
		query.createdBy = createdBy;
	}

	ResourceDocument.find(query)
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
		type,
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
				resourceDocument.set('type', type);
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

export const updateResourceVisibility = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { id: resourceId } = req.params;
	let { action } = req.query;
	action = toString(action);
	let convertedAction = false;

	if (!resourceId) {
		res.send({ success: false, msg: 'Resource Id is required!' });
		return;
	}

	if (!['0', '1'].includes(action)) {
		res.send({
			success: false,
			msg: 'Action must be in 0 or 1; (0 for false - to make visible, 1 for true - to make hidden)',
		});
		return;
	}

	if (action === '1') {
		convertedAction = true;
	}

	const playlists = await PlaylistModel.find({ items: resourceId });

	forEach(playlists, async (playlist) => {
		const { items } = playlist;
		const newItems: string[] = [];

		forEach(items, (item) => {
			if (toString(item) !== toString(resourceId)) newItems.push(toString(item));
		});

		await PlaylistModel.updateOne(
			{ _id: playlist._id },
			{ $set: { items: newItems } }
		);
	});

	ResourceDocument.updateOne(
		{ _id: resourceId },
		{ $set: { isArchived: convertedAction } }
	)
		.then(() => res.send({ success: true }))
		.catch(() => res.send({ success: false }));
};
