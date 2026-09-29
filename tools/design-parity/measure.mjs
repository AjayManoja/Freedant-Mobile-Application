// node measure.mjs <page> "<js expression returning JSON-able data>" — runs against the rebuilt reference page.
import { openPage } from './cdp.mjs';
const [name, exprArg] = process.argv.slice(2);
const expr = exprArg.startsWith('texts:')
  ? `(() => { const want = ${JSON.stringify(exprArg.slice(6).split('|'))}; const out = {}; for (const el of document.querySelectorAll('*')) { const t = (el.textContent || '').trim(); if (!want.includes(t) || out[t]) continue; if ([...el.children].some((c) => (c.textContent || '').trim() === t)) continue; const b = box(el); out[t] = [b.x, b.y, b.w, b.h, b.fs, b.lh]; } return out; })()`
  : exprArg;
const site = new URL('./refbuild/site/', import.meta.url).href;
const p = await openPage({ port: 9225, height: 932 });
try {
  await p.go(`${site}${name}.html`, 1200);
  await p.eval(
    `document.querySelectorAll('[data-scroll], .overflow-y-auto').forEach((el) => { el.style.overflow = 'visible'; el.style.flex = 'none'; }); document.fonts.ready`,
  );
  const helpers = `const box = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), pad: cs.padding, fs: cs.fontSize, lh: cs.lineHeight, fw: cs.fontWeight }; };
    const q = (s) => [...document.querySelectorAll(s)]; const cls = (sub) => q('*').filter((e) => typeof e.className === 'string' && e.className.includes(sub)); const byText = (t) => q('*').filter((e) => e.childElementCount === 0 && e.textContent.trim() === t);`;
  console.log(JSON.stringify(await p.eval(`(() => { ${helpers} return (${expr}); })()`), null, 1));
} finally {
  p.close();
}
