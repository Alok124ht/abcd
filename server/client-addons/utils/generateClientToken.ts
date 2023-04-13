export const generateClientToken = (length: number) => {
	const characters =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
	let generated = '';
	for (let i = 0; i < length; i++) {
		generated += characters[Math.floor(Math.random() * characters.length)];
	}
	return generated;
};
