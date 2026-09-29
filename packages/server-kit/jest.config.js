/** @type {import('jest').Config} */
module.exports = {
  ...require('../../jest.preset'),
  roots: ['<rootDir>/src'],
  // *.int.spec.ts need a real RabbitMQ; `pnpm test:integration` runs them (CI provides one).
  testPathIgnorePatterns: ['/node_modules/', '\\.int\\.spec\\.ts$'],
};
