// studio.mjs — shared plumbing for the motion-reel scripts: paths, the local
// server, Playwright, ffmpeg and argument parsing. No dependencies beyond
// Node 18+, Playwright and ffmpeg on PATH.

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire, register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const RUNTIME_DIR = path.join(SKILL_DIR, 'runtime');
export const TEMPLATE_DIR = path.join(SKILL_DIR, 'template');
export const ROOT = process.cwd();
export const FILMS_DIR = path.join(ROOT, 'films');

// Film modules import '/_studio/motion.mjs' in the browser; teach Node the same path.
register(new URL('./studio-hooks.mjs', import.meta.url), { data: { runtime: pathToFileURL(RUNTIME_DIR + path.sep).href } });

// ── args ────────────────────────────────────────────────────────────────────

/** --key value, --key=value, --flag; everything else is positional. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq > 0) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; }
    else out[key] = true;
  }
  return out;
}

export function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// ── films ───────────────────────────────────────────────────────────────────

export function listFilms() {
  if (!fs.existsSync(FILMS_DIR)) return [];
  return fs.readdirSync(FILMS_DIR).filter((d) => fs.existsSync(path.join(FILMS_DIR, d, 'src', 'index.html')));
}

/** 'demo' or 'films/demo' or an absolute path → the film's folders. */
export function resolveFilm(arg) {
  if (!arg) die(`Name a film. Available: ${listFilms().join(', ') || '(none — create one with new-film.mjs)'}`);
  const candidates = [path.resolve(ROOT, arg), path.join(FILMS_DIR, arg)];
  const dir = candidates.find((d) => fs.existsSync(path.join(d, 'src', 'index.html')));
  if (!dir) die(`No film at "${arg}" (looked for src/index.html). Available: ${listFilms().join(', ') || 'none'}`);
  const slug = path.basename(dir);
  const out = path.join(dir, 'out');
  const reviews = path.join(dir, 'reviews');
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(reviews, { recursive: true });
  return { slug, dir, src: path.join(dir, 'src'), out, reviews, url: '/' + path.relative(ROOT, path.join(dir, 'src')).split(path.sep).join('/') + '/' };
}

// ── local server ────────────────────────────────────────────────────────────
// Serves the project root at / and the skill runtime at /_studio/. ES modules
// need http(s), so films are never opened from file://.

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

export function startServer({ port = 0, host = '127.0.0.1' } = {}) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(url.pathname);
    let base = ROOT;
    if (rel.startsWith('/_studio/')) { base = RUNTIME_DIR; rel = rel.slice('/_studio'.length); }
    let file = path.join(base, rel);
    if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!rel.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return; }
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) {
      if (rel === '/' || rel === '/index.html') return listing(res);
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end(`404 ${rel}`);
      return;
    }
    const stat = fs.statSync(file);
    const headers = { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : stat.size - 1;
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
  });
  function listing(res) {
    const films = listFilms();
    const items = films.map((f) => `<li><a href="/films/${f}/src/">${f}</a></li>`).join('') || '<li>No films yet.</li>';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<!doctype html><meta charset="utf-8"><title>motion studio</title><body style="font:16px/1.6 ui-monospace,monospace;background:#111;color:#eee;padding:40px"><h1>films</h1><ul>${items}</ul></body>`);
  }
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => resolve({ server, origin: `http://${host}:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }));
  });
}

// ── playwright ──────────────────────────────────────────────────────────────

export async function loadChromium() {
  // the project's own node_modules first (the skill may live in ~/.claude/skills),
  // then next to the skill, then a global install
  const fromProject = createRequire(path.join(ROOT, 'package.json'));
  const tries = ['playwright', 'playwright-core'].map((name) => () => import(pathToFileURL(fromProject.resolve(name)).href));
  tries.push(() => import('playwright'), () => import('playwright-core'));
  try {
    const globalRoot = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    for (const name of ['playwright', 'playwright-core']) {
      const p = path.join(globalRoot, name, 'index.mjs');
      if (fs.existsSync(p)) tries.push(() => import(pathToFileURL(p).href));
    }
  } catch {}
  for (const t of tries) {
    try {
      const mod = await t();
      const chromium = mod.chromium || mod.default?.chromium;
      if (chromium) return chromium;
    } catch {}
  }
  die('Playwright is not installed. Run: npm install && npx playwright install chromium');
}

const CHROME_ARGS = ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb', '--hide-scrollbars', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required'];

export async function launchBrowser(chromium) {
  const opts = { args: CHROME_ARGS };
  try {
    return await chromium.launch(opts);
  } catch (err) {
    const fallbacks = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter((p) => p && fs.existsSync(p));
    for (const executablePath of fallbacks) {
      try { return await chromium.launch({ ...opts, executablePath }); } catch {}
    }
    die(`Could not start Chromium: ${err.message.split('\n')[0]}\nRun: npx playwright install chromium  (or set CHROMIUM_PATH)`);
  }
}

/**
 * Open a film in a fresh context and wait until it is ready. Collects page
 * errors so a broken composition fails loudly instead of rendering black.
 */
export async function openFilm(browser, origin, film, { format, scale = 1, guides = false } = {}) {
  const q = new URLSearchParams({ render: '1', scale: String(scale) });
  if (format) q.set('format', format);
  if (guides) q.set('guides', '1');
  // First load at a nominal size to learn the film's dimensions, then resize.
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(`${origin}${film.url}?${q}`);
  // interval polling: rAF-based polling stalls when a page isn't producing frames
  const state = await page.waitForFunction(() => window.__ready || window.__filmError, null, { timeout: 120000, polling: 100 }).then((h) => h.jsonValue()).catch(() => 'timeout');
  if (state === 'timeout') throw new Error(`Film did not become ready in 120 s.\n${errors.join('\n')}`);
  if (state !== true) throw new Error(`Film failed to load:\n${state}\n${errors.join('\n')}`);
  const info = await filmInfo(page);
  const even = (v) => Math.max(2, Math.round(v / 2) * 2); // x264 needs even sizes
  await page.setViewportSize({ width: even(info.width * scale), height: even(info.height * scale) });
  const cdp = await context.newCDPSession(page);
  return { context, page, cdp, info, errors };
}

export function filmInfo(page) {
  return page.evaluate(() => {
    const f = window.__film;
    return { duration: f.duration, fps: f.fps, format: f.format, formats: f.formats, width: f.width, height: f.height, loop: f.loop, poster: f.poster, timeline: f.timeline, audio: f.audio, violations: f.violations, missing: f.missing };
  });
}

/** Seek and capture one frame. type: 'jpeg' (fast) or 'png' (lossless). */
export async function captureFrame({ page, cdp }, t, { type = 'jpeg', quality = 95 } = {}) {
  await page.evaluate((tt) => window.__film.seek(tt), t);
  const opts = { format: type, optimizeForSpeed: true, captureBeyondViewport: false };
  if (type === 'jpeg') opts.quality = quality;
  const { data } = await cdp.send('Page.captureScreenshot', opts);
  return Buffer.from(data, 'base64');
}

// ── processes ───────────────────────────────────────────────────────────────

export function run(cmd, args, { input = null, quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => { err += d; if (!quiet) process.stderr.write(d); });
    p.on('error', (e) => reject(new Error(`${cmd}: ${e.message}`)));
    p.on('close', (code) => (code === 0 ? resolve({ out, err }) : reject(new Error(`${cmd} exited ${code}\n${err.split('\n').slice(-15).join('\n')}`))));
    if (input) p.stdin.end(input);
  });
}

export function runBinary(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let err = '';
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => reject(new Error(`${cmd}: ${e.message}`)));
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`${cmd} exited ${code}\n${err.split('\n').slice(-10).join('\n')}`))));
  });
}

export function checkTools() {
  for (const tool of ['ffmpeg', 'ffprobe']) {
    try { execSync(`${tool} -version`, { stdio: 'ignore' }); }
    catch { die(`${tool} not found on PATH. Install it (macOS: brew install ffmpeg · Ubuntu: apt install ffmpeg).`); }
  }
}

let filterList = null;
export function hasFilter(name) {
  if (filterList === null) {
    try { filterList = execSync('ffmpeg -hide_banner -filters', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); }
    catch { filterList = ''; }
  }
  return new RegExp(`\\s${name}\\s`).test(filterList);
}

export async function probe(file) {
  const { out } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,nb_frames', '-of', 'json', file]);
  return JSON.parse(out);
}

export const cpuCount = () => (os.availableParallelism ? os.availableParallelism() : os.cpus().length);

export const fmtSec = (t) => `${t.toFixed(2)}s`;
export const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
