import { isNaN, toNumber, toString } from 'lodash';
import { isValidObjectId } from 'mongoose';
import { isAtLeastModerator } from '../utils/user/role';
import UserCompleteDetailsModel from './userCompleteDetails.model';
import { getClientOfUser } from './utils/user';

export const getAdmissions = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { id, role } = req.payload;
	const query: any = {};
	const { skip, limit, keywords, client } = req.query;
	let qSkip = 0,
		qLimit = 50,
		qKeywords = toString(keywords);
	if (skip && !isNaN(toNumber(skip))) qSkip = toNumber(skip);
	if (limit && !isNaN(toNumber(limit))) qLimit = toNumber(limit);
	if (!isAtLeastModerator(role))
		return res.send({ success: false, msg: "You don't have access" });
	if (keywords && keywords !== 'undefined' && keywords !== 'null') {
		const regex = { $regex: qKeywords, $options: 'i' };
		query.studentName = regex;
		query.fatherName = regex;
		query.motherName = regex;
	}
	if (client && client !== 'undefined' && keywords !== 'null')
		if (!isValidObjectId(client))
			return res.send({ success: false, msg: 'Client id is not valid' });
		else query.client = client;

	if (role === 'moderator') {
		const { client } = await getClientOfUser(id);
		if (!client)
			return res.send({
				success: false,
				msg: "You don't have client permissions",
			});
		else query.client = client._id;
	}

	const total = await UserCompleteDetailsModel.find(query).countDocuments();
	UserCompleteDetailsModel.find(query)
		.populate([
			{
				path: 'user',
				select: 'name subscriptions.subgroups.phases.phase',
				populate: { path: 'subscriptions.subgroups.phases.phase', select: 'name' },
			},
			{ path: 'client', select: 'name' },
		])
		.skip(qSkip)
		.limit(qLimit)
		.then((users) => {
			res.send({ success: true, users, total });
		})
		.catch((err) => {
			res.send({ success: false, msg: 'Error while fetching details!' });
		});
};

export const addAdmission = (req: ExpressRequest, res: ExpressResponse) => {
	const {
		body,
		payload: { id, role },
	} = req;
	if (!isAtLeastModerator(role))
		return res.send({ success: false, msg: "You don't have permissions!" });

	if (!body)
		return res.send({
			success: false,
			msg: 'Please send proper parameters!',
		});

	const details = new UserCompleteDetailsModel(body);
	details.save((err) => {
		if (err)
			res.send({ success: false, msg: 'Details not saved!', err: err.message });
		else res.send({ success: true, msg: 'Details saved!' });
	});
};
