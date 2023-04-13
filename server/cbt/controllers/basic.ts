import { Request, Response } from 'express';
import { sendEmail } from '../../utils/mail';
import { generateClientToken } from '../../client-addons/utils/generateClientToken';
import { CbtTokenModel } from '../models/CbtToken.model';
import ClientModel from '../../client/client.model';

export const generate = async (req: Request, res: Response) => {
	const { client } = req.body;

	if (!client) {
		res.send({ success: false, msg: 'Client id not passed' });
		return;
	}

	let runAgain: boolean = true;
	let token = '';
	while (runAgain) {
		token = generateClientToken(64);
		const exist = await CbtTokenModel.findOne({ token: token });
		if (exist) {
			runAgain = true;
		} else {
			runAgain = false;
		}
	}

	const newToken = new CbtTokenModel({
		token,
		client,
		active: true,
	});

	newToken.save(async (err, saved) => {
		if (saved) {
			const clientInfo = await ClientModel.findById(client);
			sendEmail({
				subject: `${clientInfo.name} CBT token`,
				to: 'neel@prepseed.com',
				bodyType: 'html',
				body: `${clientInfo.name}'s new CBT token is as ${token}`,
				from: 'Prepseed Help center<help@prepseed.com>',
			});
			res.send({ success: true, msg: 'Cbt token created', token });
		} else {
			res.send({ success: false, msg: 'Error while creating cbt token' });
		}
	});
};

export const diasbleToken = (req: Request, res: Response) => {
	const { token, client } = req.body;
	let q: any = {};

	if (token) {
		q = {
			client,
			token,
		};
	} else {
		client;
	}

	if (!token) {
		CbtTokenModel.updateMany(
			{ client },
			{
				$set: {
					active: false,
				},
			}
		)
			.then((updated) => res.send({ success: true }))
			.catch((err) => res.send({ success: false }));
	}
};
