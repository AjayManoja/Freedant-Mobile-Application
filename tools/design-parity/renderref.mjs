// Renders design/reference pages with Poppins: node renderref.mjs <name...> → ref-poppins/<name>.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { openPage } from './cdp.mjs';
const site = new URL('./refbuild/site/', import.meta.url).href;
mkdirSync(new URL('./ref-poppins/', import.meta.url), { recursive: true });
const p = await openPage({ port: 9224 });
try {
  for (const name of process.argv.slice(2)) {
    await p.resize(932);
    await p.go(`${site}${name}.html`, 1200);
    // Unclip the app's scroll containers so the whole page lays out like the full-page capture.
    const h = await p.eval(`(() => {
      document.querySelectorAll('[data-scroll], .overflow-y-auto').forEach((el) => { el.style.overflow = 'visible'; el.style.flex = 'none'; });
      document.querySelectorAll('.min-h-screen').forEach((el) => el.style.minHeight = 'auto');
      // Closed overlays and demo toasts are capture artifacts, not part of the screen.
      document.querySelectorAll('.fixed.inset-0.pointer-events-none, .pointer-events-none.opacity-0, .absolute.left-3.right-3.top-2').forEach((el) => el.remove());
      return Math.ceil(document.documentElement.scrollHeight);
    })()`);
    await p.resize(h);
    await p.sleep(600);
    await document_fonts_ready(p);
    writeFileSync(new URL(`./ref-poppins/${name}.png`, import.meta.url), await p.shot());
    console.log(`${name}: 430x${h}`);
  }
} finally {
  p.close();
}
async function document_fonts_ready(p) {
  await p.eval('document.fonts.ready.then(() => document.fonts.size)');
}
