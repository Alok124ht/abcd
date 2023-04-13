import { Types } from 'mongoose';
import SystemReportModel from '../../models/SystemReport';
import { getTokenFromHeaders } from '../../utils/auth';

export async function recordSystemReport(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	try {
		const { description, type, message } = req.body;
		const userId = req.payload ? req.payload.id : null;
		const report = new SystemReportModel();
		report.type = type;
		report.message = message;
		report.description = description;
		report.token = getTokenFromHeaders(req);
		if (userId && Types.ObjectId.isValid(userId)) {
			report.user = Types.ObjectId(userId);
		}
		await report.save();
		res.send({ message: 'Recorded successfully' });
	} catch (e) {
		console.error(e);
		res.status(422).send({ message: 'Failed to record', error: e.message });
	}
}
