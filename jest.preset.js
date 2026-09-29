/**
 * Shared Jest settings. SWC transpiles only (type-checking is the separate `typecheck`
 * task), with decorator metadata on so NestJS dependency injection works in tests.
 * jose is ESM-only: Node 24 loads it natively at runtime, but Jest's CommonJS runtime
 * needs it transpiled, hence the node_modules exception.
 * @type {import('jest').Config}
 */
const swc = (syntax) => [
  '@swc/jest',
  {
    jsc: {
      parser: syntax === 'typescript' ? { syntax, decorators: true } : { syntax },
      transform: { legacyDecorator: true, decoratorMetadata: true },
      target: 'es2023',
      keepClassNames: true,
    },
    module: { type: 'commonjs' },
    sourceMaps: 'inline',
  },
];

module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': swc('typescript'),
    '[\\\\/]node_modules[\\\\/]jose[\\\\/].+\\.js$': swc('ecmascript'),
  },
  transformIgnorePatterns: ['[\\\\/]node_modules[\\\\/](?!jose[\\\\/])'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
