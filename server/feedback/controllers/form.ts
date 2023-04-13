import { FilterQuery, Types } from 'mongoose';
import { parseAsInteger, parseAsString } from '../../utils/query';
import FeedbackFormModel from '../models/FeedbackForm';
import { FeedbackForm } from '../types/FeedbackForm';

export async function createForm(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	try {
		const { id: userId } = req.payload;
		const { questionItems, title, description } = req.body;
		const form = new FeedbackFormModel();
		form.questionItems = questionItems;
		form.title = title;
		form.description = description;
		form.createdBy = Types.ObjectId(userId);
		await form.save();
		res.send(form);
	} catch (e) {
		next(e);
	}
}

export async function listForms(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const skip = parseAsInteger(req.query.skip, 0);
	const limit = parseAsInteger(req.query.limit, 0);
	const q = parseAsString(req.query.q);

	const query: FilterQuery<FeedbackForm> = {};
	if (q && q.trim()) {
		const regex = { $regex: new RegExp(q.trim(), 'i') };
		query.$or = [{ title: regex }];
		if (Types.ObjectId.isValid(q.trim())) {
			query.$or.push({ _id: Types.ObjectId(q.trim()) });
		}
	}
	try {
		const forms = await FeedbackFormModel.find(query)
			.populate('createdBy', 'name email')
			.limit(limit)
			.skip(skip)
			.sort({ _id: -1 });
		const total = await FeedbackFormModel.countDocuments(query);
		res.send({ items: forms, total });
	} catch (e) {
		next(e);
	}
}
