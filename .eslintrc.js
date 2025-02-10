module.exports = {
	root: true,
	env: {
		es2021: true,
		node: true,
		mocha: true,
	},
	parserOptions: {
		ecmaVersion: 13,
		sourceType: 'script',
	},
	extends: ['standard', 'prettier'],
	plugins: ['import'],
	rules: {
		// 'no-console': 'warn',
		camelcase: ['error', { properties: 'never', ignoreDestructuring: true }],
		'consistent-return': 'error',
		'no-else-return': 'error',
		'no-unused-vars': [
			'error',
			{
				vars: 'all',
				args: 'after-used',
				argsIgnorePattern: '^_',
				ignoreRestSiblings: true,
			},
		],
		'no-var': 'error',
		'object-shorthand': 'off',
		'prefer-object-spread': 'error',
		radix: 'error',
		quotes: ['error', 'single'],
		'import/no-unresolved': ['error', { commonjs: true }],
		indent: ['error', 'tab'],
		semi: ['error', 'never'],
	},
}
