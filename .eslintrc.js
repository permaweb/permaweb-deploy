module.exports = {
	parser: '@babel/eslint-parser',
	parserOptions: {
		requireConfigFile: false,
		babelOptions: {
			presets: ['@babel/preset-env'],
		},
	},
	plugins: ['import', 'simple-import-sort'],
	extends: [],
	rules: {
		'import/no-duplicates': 'error',
		'simple-import-sort/imports': 'error',
		'simple-import-sort/exports': 'error',
	},
	overrides: [
		{
			files: ['*.js'],
			rules: {
				'simple-import-sort/imports': [
					'error',
					{
						groups: [
							['^react', '^@?\\w'],
							['^arweave', '@ar.io/sdk', '@ardrive/turbo-sdk', '@permaweb/aoconnect', '^@?\\w'],
							['^\\u0000'],
							['^\\.\\.(?!/?$)', '^\\.\\./?$'],
							['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
						],
					},
				],
			},
		},
	],
};
