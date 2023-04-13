import { FilterQuery, Types } from 'mongoose';
import APIError from '../../helpers/APIError';
import { getActivePhasesFromSubscriptions } from '../../utils/phase';
import { IUser } from '../../user/IUser';
import FeedbackFormWrapperModel from '../models/FeedbackFormWrapper';
import FeedbackResponseModel from '../models/FeedbackResponse';
import { filter } from 'lodash';
import { FeedbackResponse } from '../types/FeedbackResponse';

export async function submitFeedbackFormResponse(
	req: ExpressRequest,
	res: ExpressResponse & { locals: { user: IUser } },
	next: ExpressNextFunction
) {
	const { responseByQuestionItemId, formWrapper: formWrapperId } = req.body;
	const { user } = res.locals;
	const { id: userId } = req.payload;
	try {
		const formWrapper = await FeedbackFormWrapperModel.findById(formWrapperId);
		const activePhase = getActivePhasesFromSubscriptions(user.subscriptions)[0];
		let playlistItem, resource;
		if (formWrapper.itemRef === 'Playlist' && formWrapper.formFor === 'child') {
			const { otherRefs } = req.body;
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
				next(new APIError('Resource Id must be specified'));
				return;
			}
			if (!playlistItem || !playlistItem.value) {
				next(new APIError('Playlist Item Id must be specified'));
				return;
			}
		}

		const submissionQuery: FilterQuery<FeedbackResponse> = {
			formWrapper: formWrapperId,
			user: userId,
		};
		if (resource && playlistItem) {
			submissionQuery.otherRefs = {
				$elemMatch: {
					value: {
						$in: [Types.ObjectId(resource.value), Types.ObjectId(playlistItem.value)],
					},
				},
			};
		}
		const previouslySubmittedResponse = await FeedbackResponseModel.findOne(
			submissionQuery
		);
		const feedbackResponse = previouslySubmittedResponse
			? previouslySubmittedResponse
			: new FeedbackResponseModel();
		feedbackResponse.responseByQuestionItemId = responseByQuestionItemId;
		feedbackResponse.user = Types.ObjectId(userId);
		feedbackResponse.phase = activePhase;
		feedbackResponse.formWrapper = formWrapperId;
		if (resource && playlistItem) {
			feedbackResponse.otherRefs = [
				{
					type: 'PlaylistItem',
					value: playlistItem.value,
				},
				{
					type: resource.type,
					value: resource.value,
				},
			];
		}

		await feedbackResponse.save();
		res.send({ feedbackResponse, previouslySubmittedResponse });
	} catch (e) {
		next(e);
	}
}
