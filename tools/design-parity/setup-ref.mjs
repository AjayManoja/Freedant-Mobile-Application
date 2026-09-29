// Rebuilds the design reference as a local site with Poppins, so screens can be rendered and
// measured: installs Tailwind v4, copies fonts + prototype images, strips the app script from
// design/reference/html and compiles the prototype's Tailwind theme over those pages.
// usage (from this folder): node setup-ref.mjs && node renderref.mjs home explore ...
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = join(here, '..', '..');
const build = join(here, 'refbuild');
const site = join(build, 'site');
mkdirSync(join(site, 'assets'), { recursive: true });
mkdirSync(join(site, 'fonts'), { recursive: true });

if (!existsSync(join(build, 'node_modules', '@tailwindcss', 'cli'))) {
  writeFileSync(join(build, 'package.json'), JSON.stringify({ name: 'refbuild', private: true }));
  execSync('npm install --silent tailwindcss@4 @tailwindcss/cli@4', { cwd: build, stdio: 'inherit' });
}

for (const w of ['400Regular', '500Medium', '600SemiBold', '700Bold', '800ExtraBold']) {
  copyFileSync(
    join(repo, 'node_modules', '@expo-google-fonts', 'poppins', w, `Poppins_${w}.ttf`),
    join(site, 'fonts', `Poppins_${w}.ttf`),
  );
}

const htmlDir = join(repo, 'design', 'reference', 'html');
const pages = readdirSync(htmlDir).filter((f) => f.endsWith('.html'));
const allHtml = pages.map((f) => readFileSync(join(htmlDir, f), 'utf8')).join('\n');
const assetDirs = ['competitions', 'avatars'].map((d) =>
  join(repo, 'design', 'prototype', 'src', 'assets', d),
);
for (const dir of assetDirs) {
  for (const f of readdirSync(dir)) {
    const stem = basename(f, '.jpg');
    const hashed = allHtml.match(new RegExp(`/assets/${stem}-[A-Za-z0-9_]+\.jpg`))?.[0];
    if (hashed) copyFileSync(join(dir, f), join(site, hashed.slice(1)));
  }
}

for (const f of pages) {
  const html = readFileSync(join(htmlDir, f), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<link rel="stylesheet"[^>]*>/g, '<link rel="stylesheet" href="./app.css">')
    .replace(/(src|href)="\/assets\//g, '$1="./assets/');
  writeFileSync(join(site, f), html);
}

const weights = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold' };
writeFileSync(
  join(build, 'input.css'),
  `@import 'tailwindcss' source(none);
@source "./site/*.html";
@theme {
  --font-sans: 'Poppins', ui-sans-serif, system-ui, sans-serif;
  --color-teal: #0d8074;
  --color-teal-dark: #0a6b60;
  --color-ink: #1b2b3a;
  --color-slate: #6b7d8c;
  --color-mint: #e8f5f1;
  --color-canvas: #f2f4f5;
}
${Object.entries(weights)
  .map(
    ([w, n]) =>
      `@font-face { font-family: 'Poppins'; font-weight: ${w}; src: url('./fonts/Poppins_${w}${n}.ttf'); }`,
  )
  .join('\n')}
html, body, #root { height: 100%; }
body { margin: 0; font-family: var(--font-sans); background: var(--color-canvas); color: var(--color-ink); -webkit-font-smoothing: antialiased; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
*, *::before, *::after { animation: none !important; transition: none !important; }
`,
);
execSync('npx tailwindcss -i input.css -o site/app.css', { cwd: build, stdio: 'inherit' });
console.log(`reference site ready: ${pages.length} pages in ${site}`);
