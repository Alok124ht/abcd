import { Request } from '../../types/Request';
import { NextFunction, Response } from 'express';
import SubjectModel from '../../models/Subject';
import APIError from '../../helpers/APIError';

export async function listSubjects(req: Request, res: Response) {
	const subjects = await SubjectModel.find();
	res.send({ items: subjects, total: subjects.length });
}

export async function createSubject(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { name, shortName, color, isColorDark, textColor, thumbnail } = req.body;
	const subject = new SubjectModel();
	subject.name = name;
	subject.shortName = shortName;
	subject.color = color;
	subject.isColorDark = isColorDark;
	subject.textColor = textColor;
	subject.thumbnail = thumbnail;
	try {
		await subject.save();
		res.send(subject);
	} catch (e) {
		next(new APIError(e.message, 422, true));
	}
}
export async function updateSubject(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const {
		_id,
		name,
		shortName,
		color,
		isColorDark,
		textColor,
		thumbnail,
	} = req.body;
	const subject = await SubjectModel.findById(_id);
	subject.name = name;
	subject.shortName = shortName;
	subject.color = color;
	subject.isColorDark = isColorDark;
	subject.textColor = textColor;
	subject.thumbnail = thumbnail;
	try {
		await subject.save();
		res.send(subject);
	} catch (e) {
		next(new APIError(e.message, 422, true));
	}
}
