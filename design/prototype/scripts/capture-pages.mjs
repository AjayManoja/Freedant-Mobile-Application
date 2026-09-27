// Renders every route to static HTML + a full-page screenshot so an agent can
// visually diff a rebuild against the original design. Uses system Chromium via
// puppeteer-core against the running preview server.
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:4173'
const OUT = 'reference'
const CHROME = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium'

// [route, filename] — dynamic params resolved to real records from data.ts
const routes = [
  ['/', 'home'],
  ['/login', 'login'],
  ['/signup', 'signup'],
  ['/verify', 'verify'],
  ['/forgot-password', 'forgot-password'],
  ['/competitions', 'competitions-list'],
  ['/competitions/feedants-classical-dance', 'competition-detail'],
  ['/competitions/feedants-classical-dance/results', 'leaderboard'],
  ['/search', 'search'],
  ['/wallet', 'wallet'],
  ['/refer', 'refer'],
  ['/explore', 'explore'],
  ['/explore/trending', 'list-trending'],
  ['/explore/ending', 'list-ending'],
  ['/notifications', 'notifications'],
  ['/messages', 'messages'],
  ['/messages/meera', 'chat-thread'],
  ['/host', 'host'],
  ['/submissions', 'my-submissions'],
  ['/my-competitions', 'my-competitions'],
  ['/live', 'live'],
  ['/profile', 'profile'],
  ['/settings', 'settings'],
  ['/help', 'help'],
  ['/about', 'about'],
  ['/legal/terms', 'legal-terms'],
  ['/legal/privacy', 'legal-privacy'],
  ['/winners/Manju%20Dubey', 'winner-profile'],
]

fs.mkdirSync(path.join(OUT, 'html'), { recursive: true })
fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const index = []
for (const [route, name] of routes) {
  const page = await browser.newPage()
  await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 2 })
  // Skip onboarding overlay before any app code runs
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('feedants_onboarded', '1') } catch {}
  })
  await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(2700) // let splash (2.4s) dismiss + content settle

  const html = await page.content()
  fs.writeFileSync(path.join(OUT, 'html', name + '.html'), html)
  await page.screenshot({
    path: path.join(OUT, 'screenshots', name + '.png'),
    fullPage: true,
  })
  index.push({ route, name })
  console.log('captured', route, '->', name)
  await page.close()
}

fs.writeFileSync(
  path.join(OUT, 'index.json'),
  JSON.stringify({ base: BASE, capturedAt: new Date().toISOString(), routes: index }, null, 2),
)
await browser.close()
console.log('done:', index.length, 'pages')
