module.exports = {
	rules: {
		indent: ['error', 'tab'],
		'space-before-function-paren': [
			2,
			{
				anonymous: 'always',
				named: 'never',
			},
		],
		'no-use-before-define': [2, 'nofunc'],
		// TODO: turn on later
		'comma-dangle': [0],
		'import/no-extraneous-dependencies': [
			'error',
			{
				devDependencies: true,
			},
		],
		'no-underscore-dangle': [0],
		quotes: ['warn', 'single'],
		semi: ['error', 'always'],
		'arrow-parens': ['warn', 'always'],
		'no-tabs': [0, { allowIndentationTabs: true }],
		'operator-linebreak': [0],
		'object-curly-newline': [0, 'object-curly-newline'],
		'implicit-arrow-linebreak': [0],
		'function-paren-newline': [0],
		// "no-param-reassign": [2, {"props": false}],
	},
	env: {
		node: true,
		mocha: true,
	},
	parserOptions: {
		ecmaVersion: 10,
		sourceType: 'module',
	},
	extends: ['eslint:recommended', 'airbnb-base'],
};
