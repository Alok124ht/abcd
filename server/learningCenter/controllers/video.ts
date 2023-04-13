import { forEach, includes, isEmpty, toString } from 'lodash';
import { VideoBase, VideoDocument } from '../../types/Video';
import APIError from '../../helpers/APIError';
import VideoModel from '../models/Video';
import { parseUrl, getThumbnailUrls } from '../utils/url';
import Video from '../models/Video';
import PlaylistModel from '../models/Playlist';
import logger from '../../../config/winston';

function isValidDate(d: Date) {
	return d instanceof Date && !Number.isNaN(d);
}

async function validateParams(
	video: VideoDocument,
	{
		title,
		type,
		liveFrom,
		liveTill,
		embedUrlId,
	}: Pick<VideoBase, 'title' | 'type' | 'liveFrom' | 'liveTill' | 'embedUrlId'>
) {
	if (!title || !title) {
		throw new Error('Title can not be empty');
	}

	if (type === 'Live') {
		if (!isValidDate(new Date(liveFrom))) {
			throw new Error('Live from must be a valid date');
		}
		if (!isValidDate(new Date(liveTill))) {
			throw new Error('Live till must be a valid date');
		}
	}

	if (video.isEmbeded) {
		if (isEmpty(embedUrlId) || isEmpty(embedUrlId.trim())) {
			throw new Error('Embed Url must not be empty');
		}
	}
}

export const archiveVideo = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { id: videoId } = req.body;
	const { role } = req.payload;

	if (role !== 'super' && role !== 'admin' && role !== 'moderator') {
		res.send({ success: false, msg: "You don't have permissions" });
		return;
	}

	const playlists = await PlaylistModel.find({ items: videoId });

	forEach(playlists, async (playlist) => {
		const { items } = playlist;
		const newItems: string[] = [];

		forEach(items, (item) => {
			if (toString(item) !== toString(videoId)) newItems.push(toString(item));
		});

		await PlaylistModel.updateOne(
			{ _id: playlist._id },
			{ $set: { items: newItems } }
		);
	});

	Video.updateOne({ _id: videoId }, { $set: { isArchived: true } })
		.then(() => res.send({ success: true, msg: 'Video Archived' }))
		.catch(() => res.send({ success: false, msg: 'Unable to archive' }));
};

export const unarchiveVideo = (req: ExpressRequest, res: ExpressResponse) => {
	const { id: videoId } = req.body;
	const { role } = req.payload;

	if (role !== 'super' && role !== 'admin' && role !== 'moderator') {
		res.send({ success: false, msg: "You don't have permissions" });
		return;
	}

	Video.updateOne({ _id: videoId }, { $set: { isArchived: false } })
		.then(() => res.send({ success: true, msg: 'Video restored' }))
		.catch(() => res.send({ success: false, msg: 'Unable to restore' }));
};

export async function updateVideo(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const { id: userId } = req.payload;
	const { id: videoId } = req.params;
	const {
		embedType: embedTypeUserProvided,
		title,
		description,
		type,
		liveFrom,
		liveTill,
		liveUrl,
		embedUrl,
		tags,
	} = req.body;
	try {
		const video = await VideoModel.findOne({ _id: videoId });
		if (!video) {
			next(new APIError('Video not found', 404, true));
		} else {
			let embedUrlId = embedUrl;
			let embedType = embedTypeUserProvided;
			if (includes(embedUrl, '://')) {
				try {
					const { embedUrlId: parsedEmbedUrlId, provider: parsedProvider } =
						parseUrl(embedUrl);
					embedUrlId = parsedEmbedUrlId;
					embedType = parsedProvider;
				} catch (e) {
					next(new APIError('Unable to parse embedUrl', 422, true));
					return;
				}
			}

			await validateParams(video, {
				title,
				type,
				liveTill,
				liveFrom,
				embedUrlId,
			});

			video.set('title', title);
			video.set('description', description);
			if (video.type === 'Live' && type !== 'Live') {
				video.set('liveFrom', undefined);
				video.set('liveTill', undefined);
				video.set('liveUrl', undefined);
			} else if (type === 'Live') {
				video.set('liveFrom', liveFrom);
				video.set('liveTill', liveTill);
				video.set('liveUrl', liveUrl);
			}
			video.set('type', type);
			video.set('tags', tags);

			if (video.isEmbeded) {
				if (embedType) {
					video.set('embedType', embedType);
				}
				video.set('embedUrlId', embedUrlId);
				try {
					const thumbNailsUrls = await getThumbnailUrls(video);
					video.set('thumbNailsUrls', thumbNailsUrls);
					video.save((saveError, savedVideo) => {
						if (saveError) {
							res.send({
								message: 'Error occurred, please verify all fields are filled properly',
								error: saveError.message,
							});
						} else {
							res.send({ video: savedVideo });
						}
					});
				} catch (e) {
					logger.error({ error: e.message });
					next(e);
				}
			}
		}
	} catch (searchError) {
		logger.error({ error: searchError.message });
		next(new APIError(searchError.message, 500, true));
	}
}
