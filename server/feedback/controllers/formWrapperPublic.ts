import { filter } from 'lodash';
import { FilterQuery, Types } from 'mongoose';
import APIError from '../../helpers/APIError';
import { parseAsString } from '../../utils/query';
import FeedbackFormWrapperModel from '../models/FeedbackFormWrapper';
import FeedbackResponseModel from '../models/FeedbackResponse';
import { FeedbackResponse } from '../types/FeedbackResponse';

export async function getFeedbackFormWrapper(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const { id: userId } = req.payload;
	const item = parseAsString(req.query.item);
	const itemRef = parseAsString(req.query.itemRef);
	const formFor = parseAsString(req.query.formFor);
	const { otherRefs } = req.body;

	if (itemRef !== 'Playlist') {
		res.send({});
	} else if (formFor !== 'child' && formFor !== 'self') {
		res.send({});
	} else {
		try {
			const formWrapper = await FeedbackFormWrapperModel.findOne({
				item,
				itemRef,
				formFor,
			})
				.select('form itemRef formFor')
				.populate('form', 'title questionItems');
			if (!formWrapper) {
				res.send({});
				return;
			}
			const submissionQuery: FilterQuery<FeedbackResponse> = {
				formWrapper: formWrapper._id,
				user: userId,
			};
			let playlistItem, resource;
			if (formWrapper.itemRef === 'Playlist' && formWrapper.formFor === 'child') {
				playlistItem = filter(
					otherRefs,
					({ type, value }) =>
						type === 'PlaylistItem' && Types.ObjectId.isValid(value)
				)[0];
				resource = filter(
					otherRefs,
					({ type, value }) =>
						['Video', 'Assignment', 'ResourceDocument'].includes(type) &&
						Types.ObjectId.isValid(value)
				)[0];
				if (!resource || !resource.value) {
					next(
						new APIError(
							`Resource Id must be specified ${JSON.stringify(
								resource
							)} ${JSON.stringify(otherRefs)}`
						)
					);
					return;
				}
				if (!playlistItem || !playlistItem.value) {
					next(new APIError('Playlist Item Id must be specified'));
					return;
				}
			}
			if (resource && playlistItem) {
				submissionQuery.otherRefs = {
					$all: [
						{
							$elemMatch: {
								type: resource.type,
								value: Types.ObjectId(resource.value),
							},
						},
						{
							$elemMatch: {
								type: playlistItem.type,
								value: Types.ObjectId(playlistItem.value),
							},
						},
					],
				};
			}
			const previouslySubmittedResponse = await FeedbackResponseModel.findOne(
				submissionQuery
			);
			if (previouslySubmittedResponse) {
				console.log(
					'previouslySubmittedResponse',
					previouslySubmittedResponse,
					submissionQuery,
					formWrapper
				);
				res.send({});
				return;
			}
			res.send(formWrapper);
		} catch (e) {
			next(e);
		}
	}
}
