import axios from 'axios';
import { get, toLower } from 'lodash';
import urlParser, { YouTubeParseResult } from 'js-video-url-parser';
import { VideoDocument } from '../../types/Video';

const getProviderToEmbedType = (provider: string) => {
	if (provider === 'youtube') {
		return 'Youtube';
	}
	if (provider === 'vimeo') {
		return 'vimeo';
	}
	return null;
};

export function parseUrl(
	url: string
): { provider: 'Youtube' | 'vimeo'; embedUrlId: string } {
	const parsedInfo = urlParser.parse(url) as YouTubeParseResult;
	if (!parsedInfo) {
		console.error(parsedInfo, url);
		return null;
	}

	const { provider, id } = parsedInfo;
	if (provider !== 'youtube' && provider !== 'vimeo') {
		throw new Error('Unsupported URL');
	}
	return {
		provider: getProviderToEmbedType(provider),
		embedUrlId: id,
	};
}

const getVimeoThumbnail = (vimeoId: string) =>
	axios(`https://vimeo.com/api/v2/video/${vimeoId}.json`)
		.then((res) => res.data)
		.then((item) => [get(item, [0, 'thumbnail_large'])]);

const getThumbnailUrlsForEmbedUrlId = (embedUrlId: string) =>
	Promise.resolve([`https://i.ytimg.com/vi/${embedUrlId}/mqdefault.jpg`]);

export const getThumbnailUrls = (
	video: Pick<VideoDocument, 'embedType' | 'embedUrlId'>
) => {
	if (video.embedType === 'vimeo') {
		return Promise.resolve(getVimeoThumbnail(video.embedUrlId));
	}
	if (toLower(video.embedType) === 'youtube') {
		return Promise.resolve(getThumbnailUrlsForEmbedUrlId(video.embedUrlId));
	}
	return Promise.reject(new Error(`Unknown embedType ${video.embedType}`));
};
