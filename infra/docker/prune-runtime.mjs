// Shrinks the production bundle `pnpm deploy --prod` writes (service.Dockerfile, runtime image).
//
// 1. @prisma/client declares `prisma` and `typescript` as optional peers. They are dev tools in
//    every service, so pnpm resolves the peers and the deploy carries the Prisma CLI (with
//    Studio, PGlite, effect, ...) and TypeScript into production. This keeps only packages
//    reachable from the service's dependencies through dependencies, optionalDependencies and
//    *required* peers, and deletes the rest.
// 2. The Prisma query compiler ships one WebAssembly build per database; only PostgreSQL is used.
//
//   node infra/docker/prune-runtime.mjs /out
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = realpathSync(process.argv[2]);
const modules = join(root, 'node_modules');
const UNUSED_DATABASES = /\.(cockroachdb|mysql|sqlite|sqlserver)\./;

const manifest = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

/** Node's resolution: the nearest node_modules/<name> walking up from a package folder. */
const resolve = (fromDir, name) => {
  for (let dir = fromDir; dir !== dirname(root); dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
  }
  return null;
};

const edges = (pkg) => {
  const optionalPeers = pkg.peerDependenciesMeta ?? {};
  const requiredPeers = Object.keys(pkg.peerDependencies ?? {}).filter((n) => !optionalPeers[n]?.optional);
  return [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
    ...requiredPeers,
  ];
};

const keep = new Set();
const queue = [root];
while (queue.length > 0) {
  const dir = queue.pop();
  for (const name of edges(manifest(dir))) {
    const found = resolve(dir, name);
    if (found && !keep.has(found)) {
      keep.add(found);
      queue.push(found);
    }
  }
}

/** Every package folder under a node_modules directory, nested ones included. */
const packagesIn = (nodeModules) => {
  if (!existsSync(nodeModules)) return [];
  const found = [];
  for (const entry of readdirSync(nodeModules)) {
    if (entry.startsWith('.')) continue;
    const path = join(nodeModules, entry);
    const dirs = entry.startsWith('@') ? readdirSync(path).map((child) => join(path, child)) : [path];
    for (const dir of dirs) {
      if (!existsSync(join(dir, 'package.json'))) continue;
      found.push(dir, ...packagesIn(join(dir, 'node_modules')));
    }
  }
  return found;
};

let removed = 0;
for (const dir of packagesIn(modules)) {
  if (!existsSync(dir)) continue; // inside a folder already removed
  if (!keep.has(realpathSync(dir))) {
    rmSync(dir, { recursive: true, force: true });
    removed++;
  }
}

// Launchers in .bin that now point at removed packages.
const bin = join(modules, '.bin');
if (existsSync(bin)) {
  for (const entry of readdirSync(bin)) {
    const path = join(bin, entry);
    if (lstatSync(path).isSymbolicLink() && !existsSync(path)) rmSync(path, { force: true });
  }
}

let wasm = 0;
const runtime = join(modules, '@prisma', 'client', 'runtime');
if (existsSync(runtime)) {
  for (const file of readdirSync(runtime).filter((f) => UNUSED_DATABASES.test(f))) {
    rmSync(join(runtime, file), { force: true });
    wasm++;
  }
}

process.stdout.write(
  `prune-runtime: kept ${keep.size} packages, removed ${removed}, dropped ${wasm} unused query-compiler files\n`,
);
