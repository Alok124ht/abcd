import { NextFunction, Response } from 'express';
import { Request } from '../types/Request';
import { Client } from '../types/Client';
import Batch from '../models/Batch';

export async function create(
	req: Request,
	res: Response & { locals: { client: Client } },
	next: NextFunction
) {
	const { name } = req.body;
	const { client } = res.locals;
	const batch = new Batch({ name, client: client._id });
	try {
		await batch.save();
		res.send(batch);
	} catch (e) {
		next(e);
	}
}

export async function list(
	_req: Request,
	res: Response & { locals: { client: Client } }
) {
	const clientId = res.locals.client && res.locals.client._id;
	const batches = await Batch.find({ client: clientId });
	res.send({ items: batches });
}
