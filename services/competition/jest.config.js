/** @type {import('jest').Config} */
module.exports = {
  ...require('../../jest.preset'),
  roots: ['<rootDir>/src', '<rootDir>/test'],
  globalSetup: '@feedants/testing/postgres-global-setup',
  globalTeardown: '@feedants/testing/postgres-global-teardown',
  testTimeout: 30_000,
};
