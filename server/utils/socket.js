const notifyUser = (userId, type, payload) => {
	// const stringUser = typeof userId === 'string' ? userId : userId.toString();
	// global.ioNamespace.to(stringUser).emit(type, payload);
};

const notifyUsers = (users, type, payload) => {
	users.forEach((userId) => {
		notifyUser(userId, type, payload);
	});
};

module.exports = {
	notifyUsers,
	notifyUser,
};
