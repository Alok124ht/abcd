export function getRandomString(
	stringLength: number,
	options?: { onlyAlphabets?: boolean }
) {
	let result = '';
	const alphabets = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	const alphaNumeric =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const characters = options && options.onlyAlphabets ? alphabets : alphaNumeric;
	const charactersLength = characters.length;
	// eslint-disable-next-line
	for (let i = 0; i < stringLength; i = i + 1) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}
