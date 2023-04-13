import { forEach, isNaN, toNumber, toString } from 'lodash';
import { getClientOfUser } from '../user/utils/user';
import UserModel from '../user/user.model';
import FeesModel from './fees.model';
import AdminPermissionModel from '../admin/permissions/models/AdminPermissionModel';

export const addFees = async (req: ExpressRequest, res: ExpressResponse) => {
	const { id } = req.payload;
	const {
		user,
		date,
		amount,
		standerd,
		division,
		paidVia,
		notes,
		checkNo,
		bank,
		upiId,
		transactionId,
		referenceId,
		feeType,
		policy,
	} = req.body;

	if (
		!user ||
		!date ||
		!amount ||
		!standerd ||
		!division ||
		!paidVia ||
		!feeType
	)
		return res.send({ success: false, msg: 'Please send proper parameters!' });

	const dbUser = await UserModel.findById({ _id: user }).select(
		'subscriptions.subgroups.phases.phase'
	);

	let phase: string | null = null;

	if (!dbUser) return res.send({ success: false, msg: 'User not found!' });
	else {
		forEach(dbUser.subscriptions, (sub) => {
			forEach(sub.subgroups, (grp) => {
				forEach(grp.phases, (ph) => {
					phase = toString(ph.phase);
				});
			});
		});
		if (!phase) return res.send({ success: false, msg: 'Phase not found!' });
	}

	new FeesModel({
		addedBy: id,
		user,
		date,
		amount,
		standerd,
		division,
		paidVia,
		phase,
		notes,
		checkNo,
		bank,
		upiId,
		transactionId,
		referenceId,
		feeType,
		policy,
	}).save((err) => {
		if (err) res.send({ success: false, msg: 'Error while adding Fees' });
		else res.send({ success: true, msg: 'Fee added!' });
	});
};

export const getFees = async (req: ExpressRequest, res: ExpressResponse) => {
	const { id, role } = req.payload;
	const { keywords, skip, limit } = req.query;
	const query: any = {};
	let qLimit = 50;
	let qSkip = 0;

	const phases: any[] = [];

	if (['mentor', 'moderator'].includes(role)) {
		if (role === 'moderator') {
			const { client } = await getClientOfUser(id);
			if (!client) return res.send({ success: false, msg: 'Client not found!' });
			else
				forEach(client.phases, (ph) => {
					phases.push(ph);
				});
		} else {
			const adminPhases = await AdminPermissionModel.find({
				grantedToModel: 'User',
				grantedTo: id,
				grantedOnModel: 'Phase',
			});
			forEach(adminPhases, (admin) => {
				phases.push(admin.grantedOn);
			});
		}
		if (phases.length === 0)
			return res.send({
				success: false,
				msg: "It seems you don't have any phase access!",
			});
		else query.phase = { $in: phases };
	}

	if (keywords) {
		const regex = { $regex: keywords, $options: 'i' };
		query.name = regex;
	}
	if (skip && !isNaN(toNumber(skip))) qSkip = toNumber(skip);
	if (limit && !isNaN(toNumber(limit))) qLimit = toNumber(limit);

	FeesModel.find(query)
		.populate([
			{ path: 'phase', select: 'name' },
			{ path: 'user', select: 'name' },
			{ path: 'addedBy', select: 'name role' },
		])
		.limit(qLimit)
		.skip(qSkip)
		.sort({ createdAt: -1 })
		.then(async (fees) => {
			const total = await FeesModel.find(query).countDocuments();
			res.send({ success: true, fees, total });
		})
		.catch((err) =>
			res.send({ success: false, msg: 'Error while fetching data!' })
		);
};

export const getFeeDetails = (req: ExpressRequest, res: ExpressResponse) => {
	const { id } = req.query;

	FeesModel.findById(id)
		.populate([
			{ path: 'phase', select: 'name' },
			{ path: 'user', select: 'name identifyNo' },
			{ path: 'addedBy', select: 'name role' },
		])
		.then(async (fee) => {
			res.send({ success: true, fee });
		})
		.catch((err) =>
			res.send({ success: false, msg: 'Error while fetching data!' })
		);
};
