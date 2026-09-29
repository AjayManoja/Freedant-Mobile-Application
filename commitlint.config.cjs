module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'mobile',
        'identity',
        'competition',
        'payment',
        'notification',
        'shared',
        'server-kit',
        'infra',
        'ci',
        'docs',
        'design',
        'requirements',
        'deps',
      ],
    ],
  },
};
