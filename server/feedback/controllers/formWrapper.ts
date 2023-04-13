import { FilterQuery, Types } from 'mongoose';
import { parseAsInteger, parseAsString } from '../../utils/query';
import FeedbackFormWrapperModel from '../models/FeedbackFormWrapper';
import { FeedbackFormWrapper } from '../types/FeedbackFormWrapper';

export async function createFormWrapper(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	try {
		const { id: userId } = req.payload;
		const { item: itemId, itemRef, form: formId, formFor } = req.body;
		const formWrapper = new FeedbackFormWrapperModel();
		formWrapper.item = itemId;
		formWrapper.itemRef = itemRef;
		formWrapper.form = formId;
		formWrapper.formFor = formFor;
		formWrapper.createdBy = Types.ObjectId(userId);
		await formWrapper.save();
		res.send(formWrapper);
	} catch (e) {
		next(e);
	}
}

export async function listFormWrappers(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const skip = parseAsInteger(req.query.skip, 0);
	const limit = parseAsInteger(req.query.limit, 0);

	const query: FilterQuery<FeedbackFormWrapper> = {};
	try {
		const forms = await FeedbackFormWrapperModel.find(query)
			.limit(limit)
			.skip(skip)
			.sort({ _id: -1 });
		const total = await FeedbackFormWrapperModel.countDocuments(query);
		res.send({ items: forms, total });
	} catch (e) {
		next(e);
	}
}

export async function getFormWrapper(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const itemType = parseAsString(req.query.itemType);
	const itemId = parseAsString(req.query.item);
	try {
		const wrapper = await FeedbackFormWrapperModel.findOne({
			item: itemId,
			itemType,
		});
		res.send(wrapper);
	} catch (e) {
		next(e);
	}
}
