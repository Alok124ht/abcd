const AWS = require('aws-sdk');
const sanitizeFilename = require('sanitize-filename');
const { includes } = require('lodash');
const Video = require('../models/Video').default;
const VideoDraft = require('../models/VideoDraft');
const APIError = require('../../helpers/APIError');
const { parseUrl, getThumbnailUrls } = require('../utils/url');
const { getRandomString } = require('../../utils/string');
const s3 = require('../../aws/s3').default;

const filePrefix =
	process.env.NODE_ENV === 'production' ? 'p/' : `${process.env.NODE_ENV}/`;

const sanitize = (fileName) => {
	if (!fileName) {
		return getRandomString(20);
	}
	return sanitizeFilename(fileName).split(' ').join('');
};

const getPolicy = (userId, mime, fileName, headers, callback) => {
	const filePath = `${filePrefix}u/${userId}/${getRandomString(
		20
	)}/raw/${fileName}`;
	return s3.createPresignedPost(
		{
			Bucket: process.env.AWS_VIDEO_UPLOAD_BUCKET,
			Expires: 3600,
			Conditions: [{ key: filePath }],
			Fields: {
				acl: 'private',
				key: filePath,
				mime,
				...headers,
			},
		},
		(err, data) => callback(err, data, filePath)
	);
};

const createDraft = (req, res) => {
	const { id: userId } = req.payload;
	const { mime, fileName, title, description } = req.body;
	const sanitizedFileName = sanitize(fileName);
	getPolicy(userId, mime, sanitizedFileName, {}, (err, data, filePath) => {
		if (err) {
			res
				.status(422)
				.send({ message: 'Error occurred while creating upload url', error: err });
		} else {
			const videoDraft = new VideoDraft();
			videoDraft.srcVideo = data.fields.key;
			videoDraft.srcBucket = data.fields.bucket;
			videoDraft.title = title;
			videoDraft.description = description;
			videoDraft.createdBy = userId;
			videoDraft.save((error, savedVideoDraft) => {
				if (error) {
					res.status(422).send({
						message: 'Error occurred while creating video draft.',
						error: error.message,
					});
				} else {
					res.send({ data, filePath, videoDraft: savedVideoDraft });
				}
			});
		}
	});
};

const createEmbed = async (req, res, next) => {
	const { id: userId } = req.payload;
	const {
		embedUrl,
		embedType: embedTypeUserProvided,
		title,
		description,
		isLive,
		type,
		liveFrom,
		liveTill,
		liveUrl,
		tags,
	} = req.body;
	let embedUrlId = embedUrl;
	let embedType = embedTypeUserProvided;
	if (includes(embedUrl, '://')) {
		try {
			const { embedUrlId: parsedEmbedUrlId, provider: parsedProvider } =
				parseUrl(embedUrl);
			embedUrlId = parsedEmbedUrlId;
			embedType = parsedProvider;
		} catch (e) {
			next(
				new APIError('Unable to parse embedUrl. Please verify the URL.', 422, true)
			);
			return;
		}
	}
	const video = new Video({
		embedUrlId,
		embedType,
		title,
		description,
		createdBy: userId,
		isEmbeded: true,
		tags,
	});
	getThumbnailUrls(video)
		.then((thumbNailsUrls) => {
			video.set('thumbNailsUrls', thumbNailsUrls);
			if (type === 'Live' || isLive === '1' || isLive === 1) {
				video.type = 'Live';
				video.liveFrom = liveFrom;
				video.liveTill = liveTill;
				video.liveUrl = liveUrl;
			}
			video.save((saveError) => {
				if (saveError) {
					res
						.status(422)
						.send({ message: 'Error occurred', error: saveError.message });
				} else {
					res.send({ video });
				}
			});
		})
		.catch((error) => {
			next(
				new APIError(
					error ? error.message : 'Failed to create thumbnail',
					422,
					true
				)
			);
		});
};

const createHLS = async (req, res) => {
	const { id: userId } = req.payload;
	const {
		title,
		description,
		isLive,
		liveFrom,
		liveTill,
		liveUrl,
		tags,
		thumbNailsUrls,
	} = req.body;
	const streamKey = getRandomString(16);
	const hlsEndpoint = `https://videos-prepleaf.s3.ap-south-1.amazonaws.com/hls/${streamKey}.m3u8`;
	const video = new Video({
		title,
		description,
		createdBy: userId,
		isEmbeded: false,
		tags,
		streamKey,
		endpoints: {
			HLS: hlsEndpoint,
		},
	});
	video.set('thumbNailsUrls', thumbNailsUrls);
	if ((isLive && isLive === '1') || isLive === 1) {
		video.type = 'Live';
		video.liveFrom = liveFrom;
		video.liveTill = liveTill;
		video.liveUrl = liveUrl;
	}
	try {
		await video.save();
		res.send({ video });
	} catch (saveError) {
		res.status(422).send({ message: 'Error occurred', error: saveError.message });
	}
};

const onIngestJobComplete = (req, res) => {
	const { message } = res.locals;
	const { thumbNailsUrls, egressEndpoints, guid, srcBucket, srcVideo } = message;
	VideoDraft.findOne({ srcVideo, srcBucket }).exec((error, videoDraft) => {
		if (error) {
			// TOOD: report error
			// eslint-disable-next-line no-console
			console.error(error);
			res
				.status(500)
				.send({ message: 'Internal Server Error', error: error.message });
		} else if (!videoDraft) {
			res.status(422).send({ message: 'Not record found for this file.' });
		} else {
			const video = new Video({
				title: videoDraft.title,
				description: videoDraft.description,
				thumbNailsUrls,
				endpoints: egressEndpoints,
				guid,
				createdBy: videoDraft.createdBy,
			});
			video.save((saveError, savedVideo) => {
				if (saveError) {
					// eslint-disable-next-line no-console
					console.error(saveError);
					res.status(422).send({
						message: 'Error occurred while saving the video',
						error: saveError.message,
					});
				} else {
					videoDraft.set('isProcessed', true);
					videoDraft.save((draftUpdateError) => {
						if (draftUpdateError) {
							// TODO: notify or rollback
						}
					});
					res.send({ savedVideo });
				}
			});
		}
	});
};

module.exports = {
	filePrefix,
	createDraft,
	onIngestJobComplete,
	createEmbed,
	createHLS,
};
