const getTokenFromHeaders = (req) => {
	const {
		headers: { authorization },
		cookies,
	} = req;
	if (cookies.auth) {
		return cookies.auth;
	}
	if (
		authorization &&
		(authorization.split(' ')[0] === 'Token' ||
			authorization.split(' ')[0] === 'Bearer')
	) {
		return authorization.split(' ')[1];
	}
	const { authorization: postAuthorization } = req.body;
	if (
		postAuthorization &&
		(postAuthorization.split(' ')[0] === 'Token' ||
			postAuthorization.split(' ')[0] === 'Bearer')
	) {
		return postAuthorization.split(' ')[1];
	}
	return null;
};

module.exports = { getTokenFromHeaders };
