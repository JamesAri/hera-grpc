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
	extends: ['standard', 'plugin:prettier/recommended'],
	plugins: ['import'],
	rules: {
		'no-console': 'warn',
		'no-extra-parens': 'off',
		'object-curly-spacing': ['error', 'always'],
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
		semi: ['error', 'never'],
		'import/no-unresolved': ['error', { commonjs: true }],
		'import/order': [
			'error',
			{
				groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
				'newlines-between': 'always',
				alphabetize: { order: 'asc', caseInsensitive: true },
			},
		],
		'newline-per-chained-call': ['error', { ignoreChainWithDepth: 1 }],
	},
}
