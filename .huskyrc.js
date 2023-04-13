const tasks = (arr) => arr.join(' && ');

const taskList = [
	'npx pretty-quick --staged',
	// 'npm test',
	//'npm run build-ts'
];
module.exports = {
	hooks: {
		'pre-commit': tasks(taskList),
	},
};
