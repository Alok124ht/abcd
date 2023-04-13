import { ClientTokenModel } from '../models/clientToken.model';
const verify = async (
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) => {
	let token;
	if (req.body.token) token = req.body.token;
	else if (req.query.token) token = req.query.token;

	if (!token) {
		res.status(403).send({ message: 'Unauthorized access' });
		return;
	}
	const clientToken = await ClientTokenModel.findOne({ token, active: true });
	if (!clientToken) {
		res.status(403).send({ message: 'Unauthorized access' });
		return;
	}
	req.payload = { token: clientToken };
	next();
};

export = verify;
