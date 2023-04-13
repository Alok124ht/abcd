import { default as tokenModel } from '../token/token.model';

const getTokenFromHeaders = (req) => {
	const {
		headers: { authorization },
		cookies,
	} = req;
	let token = null;
	if (cookies.auth) {
		token = cookies.auth;
	}
	if (
		authorization &&
		(authorization.split(' ')[0] === 'Token' ||
			authorization.split(' ')[0] === 'Bearer')
	) {
		token = authorization.split(' ')[1];
	}
	const { authorization: postAuthorization } = req.body;
	if (
		postAuthorization &&
		(postAuthorization.split(' ')[0] === 'Token' ||
			postAuthorization.split(' ')[0] === 'Bearer')
	) {
		token = postAuthorization.split(' ')[1];
	}
	if (token !== null) {
		tokenModel
			.updateOne(
				{
					token,
				},
				{
					$set: {
						updatedAt: Date.now(),
					},
				}
			)
			.then(() => {})
			.catch(() => {});
	}
	return token;
};

export default getTokenFromHeaders;
