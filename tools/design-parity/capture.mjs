// Screenshots the Expo web app like design/reference: 430 px wide @2x, full content height.
// usage: node capture.mjs <out.png> <route> [heightCss=932] [--auth=email] [--click=text,...] [--wait=ms]
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [out, route = '/', heightArg] = args.filter((a) => !a.startsWith('--'));
const height = Number(heightArg ?? 932);
const APP = 'http://localhost:8081';
const API = 'http://localhost:8080';
const PORT = 9223;

async function signIn(email) {
  const cache = join(here, `session-${email}.json`);
  if (existsSync(cache)) {
    const old = JSON.parse(readFileSync(cache, 'utf8'));
    const r = await fetch(API + '/v1/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: old.refreshToken }),
    });
    if (r.ok) {
      const fresh = await r.json();
      writeFileSync(cache, JSON.stringify(fresh));
      return fresh;
    }
  }
  const fresh = await otpSignIn(email);
  writeFileSync(cache, JSON.stringify(fresh));
  return fresh;
}

async function otpSignIn(email) {
  const post = (p, b) =>
    fetch(API + p, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(b),
    }).then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(`${p} ${r.status} ${await r.text()}`))));
  await post('/v1/auth/otp/request', { email }).catch((e) => {
    if (!String(e).includes('429')) throw e; // resend cooldown: reuse the last code
  });
  await new Promise((r) => setTimeout(r, 1200));
  const found = await (
    await fetch(`http://localhost:8025/api/v1/search?query=${encodeURIComponent('to:' + email)}&limit=1`)
  ).json();
  const msg = await (await fetch(`http://localhost:8025/api/v1/message/${found.messages[0].ID}`)).json();
  const code = msg.Text.match(/\b\d{6}\b/)[0];
  return post('/v1/auth/otp/verify', { email, code });
}

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = join(here, 'chrome-profile');
mkdirSync(profile, { recursive: true });
const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
]);

let ws;
let seq = 0;
const pending = new Map();
const events = [];
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

try {
  let version;
  for (let i = 0; i < 50 && !version; i++) {
    version = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      .then((r) => r.json())
      .catch(() => null);
    if (!version) await new Promise((r) => setTimeout(r, 200));
  }
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    } else if (m.method) events.push(m);
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  await s('Page.enable');
  await s('Runtime.enable');
  await s('Emulation.setDeviceMetricsOverride', { width: 430, height, deviceScaleFactor: 2, mobile: true });

  // Seed storage on the app origin, then load the route.
  await s('Page.navigate', { url: APP + '/' });
  await new Promise((r) => setTimeout(r, 1500));
  const session = flags.auth ? await signIn(flags.auth) : null;
  const storage = {
    'feedants.onboarded': '1',
    'feedants.session': session
      ? JSON.stringify({ accessToken: session.accessToken, refreshToken: session.refreshToken })
      : null,
  };
  await s('Runtime.evaluate', {
    expression: `localStorage.clear(); ${Object.entries(storage)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`)
      .join('')}`,
  });
  await s('Page.navigate', { url: APP + route });
  await new Promise((r) => setTimeout(r, Number(flags.wait ?? 4000)));

  for (const text of (flags.click ?? '').split(',').filter(Boolean)) {
    const { result } = await s('Runtime.evaluate', {
      expression: `(() => { const els = [...document.querySelectorAll('[role=button],button,a,[tabindex]')];
        const el = els.find((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().includes(${JSON.stringify(text)}));
        if (!el) return 'missing'; el.click(); return 'ok'; })()`,
      returnByValue: true,
    });
    if (result.value !== 'ok') console.error(`click "${text}": ${result.value}`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (flags.after) await new Promise((r) => setTimeout(r, Number(flags.after)));
  if (flags.texts) {
    // Boxes of the innermost elements whose text equals each label (CSS px, page coordinates).
    const labels = flags.texts.split('|');
    const { result } = await s('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
      const want = ${JSON.stringify(labels)};
      const out = {};
      for (const el of document.querySelectorAll('*')) {
        const t = (el.textContent || '').trim();
        if (!want.includes(t) || out[t]) continue;
        if ([...el.children].some((c) => (c.textContent || '').trim() === t)) continue;
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        out[t] = [Math.round(r.x*10)/10, Math.round(r.y*10)/10, Math.round(r.width*10)/10, Math.round(r.height*10)/10, cs.fontSize, cs.lineHeight, cs.fontFamily.split(',')[0]];
      }
      return out; })()`,
    });
    for (const l of labels) console.log(l.padEnd(34), JSON.stringify(result.value[l] ?? null));
  }
  const { data } = await s('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(data, 'base64'));
  const errors = events
    .filter((e) => e.method === 'Runtime.exceptionThrown')
    .map((e) => e.params.exceptionDetails.exception?.description?.split('\n')[0]);
  console.log(
    `saved ${out} (${route}, 430x${height}@2x)${errors.length ? ' errors: ' + errors.join(' | ') : ''}`,
  );
} finally {
  ws?.close();
  chrome.kill();
}
