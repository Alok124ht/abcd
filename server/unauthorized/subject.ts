import { NextFunction, Response } from 'express';
import { Request } from '../types/Request';
import SubjectModel from '../models/Subject';

export async function getAllSubjects(
	_req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const subjects = await SubjectModel.find();
		res.send({ items: subjects, total: subjects.length });
	} catch (e) {
		next(e);
	}
}
