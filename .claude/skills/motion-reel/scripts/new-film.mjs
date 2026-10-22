#!/usr/bin/env node
// new-film.mjs — start a film from the template.
//
//   node new-film.mjs <slug> [--duration 15] [--formats 16x9,9x16] [--fps 60] [--title "Acme launch"]
//
// Creates films/<slug>/ with brief.md, style_guide.md, shotlist.md, STATUS.md,
// assets/, refs/, reviews/, out/ and a seekable src/ that renders on day one.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, die, FILMS_DIR, TEMPLATE_DIR, SKILL_DIR, ROOT } from './lib/studio.mjs';

const args = parseArgs();
const slug = args._[0];
if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) die('Usage: node new-film.mjs <slug> — lowercase letters, digits and dashes, e.g. acme-launch');
const dest = path.join(FILMS_DIR, slug);
if (fs.existsSync(dest)) die(`films/${slug} already exists. Pick another slug or edit that film.`);

const duration = Number(args.duration || 15);
const fps = Number(args.fps || 60);
const formats = String(args.formats || '16x9').split(',').map((s) => s.trim()).filter(Boolean);
const known = ['16x9', '9x16', '1x1', '4x5'];
for (const f of formats) if (!known.includes(f)) die(`Unknown format ${f}. Use ${known.join(', ')}.`);
const vars = {
  SLUG: slug,
  TITLE: args.title || slug,
  DURATION: String(duration),
  FPS: String(fps),
  FORMATS: JSON.stringify(formats),
  FORMAT_LIST: formats.join(', '),
  DATE: new Date().toISOString().slice(0, 10),
};

function copy(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, e.name), to = path.join(dst, e.name);
    if (e.isDirectory()) copy(from, to);
    else if (/\.(md|html|mjs|js|css|json)$/.test(e.name)) fs.writeFileSync(to, fs.readFileSync(from, 'utf8').replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m));
    else fs.copyFileSync(from, to);
  }
}
copy(TEMPLATE_DIR, dest);
for (const d of ['reviews', 'out', 'assets/fonts', 'assets/screens', 'assets/audio']) fs.mkdirSync(path.join(dest, d), { recursive: true });

const rel = path.relative(ROOT, dest);
console.log(`✔ ${rel} · ${duration}s · ${formats.join(', ')} @ ${fps} fps`);
console.log(`  next: fill ${rel}/brief.md and collect real assets (GATE 1), then style_guide.md + shotlist.md (GATE 2).`);
const render = path.join(SKILL_DIR, 'scripts', 'render.mjs');
const shown = path.relative(ROOT, render).startsWith('..') ? render : path.relative(ROOT, render);
const pkg = path.join(ROOT, 'package.json');
const viaNpm = fs.existsSync(pkg) && /render\.mjs/.test(JSON.parse(fs.readFileSync(pkg, 'utf8')).scripts?.render || '');
console.log(`  smoke test: ${viaNpm ? `npm run render -- ${slug}` : `node ${shown} ${slug}`} --stills every:1`);
