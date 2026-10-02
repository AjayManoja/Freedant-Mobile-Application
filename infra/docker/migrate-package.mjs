// Writes the package.json of the slim `migrate` image (service.Dockerfile): only the Prisma CLI
// and dotenv (prisma.config.ts imports it), pinned to the versions the build stage resolved
// from the lockfile. Run from a service folder: node infra/docker/migrate-package.mjs <out-dir>
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const versionOf = (name) => {
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    const manifest = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(manifest)) return JSON.parse(readFileSync(manifest, 'utf8')).version;
    if (dirname(dir) === dir) throw new Error(`${name} is not installed`);
  }
};

const out = process.argv[2];
const pkg = { private: true, dependencies: { prisma: versionOf('prisma'), dotenv: versionOf('dotenv') } };
writeFileSync(join(out, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
process.stdout.write(`migrate image: prisma ${pkg.dependencies.prisma}, dotenv ${pkg.dependencies.dotenv}\n`);
