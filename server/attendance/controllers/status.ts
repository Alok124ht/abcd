import { attendanceStatuses } from '../utils';

export async function getAllStatuses(
	_req: ExpressRequest,
	res: ExpressResponse
) {
	res.send(attendanceStatuses);
}
