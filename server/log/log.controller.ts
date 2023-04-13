import APIError from '../helpers/APIError';
import FlowLog from './flowlog.model';

export async function flow(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const {
		payload: { role },
	} = req;

	if (role !== 'admin' && role !== 'super') {
		next(new APIError('Action not allowed'));
		return;
	}

	const { uid, wid } = req.body;

	if (wid) {
		FlowLog.find({ user: uid, wrapperId: wid }).then((flows) => {
			res.json({ success: true, flows });
		});
	} else {
		FlowLog.find({ user: uid })
			.sort({ _id: -1 })
			.limit(500)
			.then((flows) => {
				res.json({ success: true, flows: flows.reverse() });
			});
	}
}
