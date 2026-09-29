/** @type {import("jest").Config} */
module.exports = {
  ...require('../../jest.preset'),
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts'],
};
