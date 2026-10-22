#!/usr/bin/env node
// reference.mjs — take a reference video apart so its grammar can be written down.
//
//   node reference.mjs <video> [--every 0.5] [--scene 0.3] [--out dir]
//
// Writes <video>-ref/ next to the video:
//   sheet-N.png  a frame every 0.5 s with timestamps (study pacing, type, layout)
//   cuts.json    scene changes, shot lengths, palette, motion — the numbers for style_guide.md
//   summary.md   the same in words
// Take the grammar (pace, type scale, transitions, camera, palette roles),
// never the subjects, logos or copy.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, startServer, loadChromium, launchBrowser, run, runBinary, checkTools, die, ROOT } from './lib/studio.mjs';
import { renderSheet } from './lib/sheet.mjs';

const args = parseArgs();
checkTools();
const video = args._[0] && path.resolve(args._[0]);
if (!video || !fs.existsSync(video)) die('Usage: node reference.mjs <video> [--every 0.5]');
const base = path.basename(video).replace(/\.[^.]+$/, '');
const inRoot = !path.relative(ROOT, video).startsWith('..');
const out = path.resolve(args.out || (inRoot ? path.join(path.dirname(video), `${base}-ref`) : path.join(ROOT, 'refs', `${base}-ref`)));
const tmp = path.join(out, '.frames');
fs.mkdirSync(tmp, { recursive: true });
const rel = (p) => path.relative(ROOT, p);
const fmtT = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;

const { out: pj } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', video]);
const info = JSON.parse(pj);
const { width: W, height: H } = info.streams[0];
const duration = Number(info.format.duration);
const [fn, fd] = info.streams[0].r_frame_rate.split('/').map(Number);
const fps = fn / (fd || 1);
const every = Number(args.every || 0.5);

// scene changes
const { err } = await run('ffmpeg', ['-hide_banner', '-i', video, '-vf', `select=gt(scene\\,${Number(args.scene || 0.3)}),showinfo`, '-f', 'null', '-']);
const cuts = [...err.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1])).filter((t) => t > 0.05);
const bounds = [0, ...cuts, duration];
const shots = bounds.slice(1).map((t, i) => Number((t - bounds[i]).toFixed(3)));
const sorted = [...shots].sort((a, b) => a - b);

// palette: 12 colors across the whole video, darkest to lightest
const pal = await runBinary('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', 'fps=1,scale=160:-2,palettegen=max_colors=12:reserve_transparent=0:stats_mode=full', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
const seen = new Set();
const palette = [];
for (let i = 0; i + 2 < pal.length && palette.length < 12; i += 3) {
  const hex = '#' + [pal[i], pal[i + 1], pal[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
  if (!seen.has(hex)) { seen.add(hex); palette.push(hex); }
}
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
palette.sort((a, b) => lum(a) - lum(b));

// motion: how kinetic is it, and how much of it holds still
const mw = 64, mh = Math.max(2, Math.round((mw * H) / W / 2) * 2);
const gray = await runBinary('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', `scale=${mw}:${mh}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
const fsz = mw * mh, n = Math.floor(gray.length / fsz);
let total = 0, still = 0;
for (let i = 1; i < n; i++) {
  let s = 0;
  for (let k = 0; k < fsz; k++) s += Math.abs(gray[i * fsz + k] - gray[(i - 1) * fsz + k]);
  s /= fsz;
  total += s;
  if (s < 0.3) still++;
}

// contact sheets
const tile = H > W ? 180 : W === H ? 240 : 320;
await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-vf', `fps=${1 / every},scale=${tile}:-2:flags=lanczos`, '-q:v', '2', path.join(tmp, 'f-%04d.jpg')]);
const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.jpg')).sort();
const server = await startServer();
const browser = await launchBrowser(await loadChromium());
const sheets = [];
try {
  for (let i = 0; i < files.length; i += 36) {
    const part = files.slice(i, i + 36).map((f, k) => {
      const t = (i + k) * every;
      return { file: path.join(tmp, f), label: fmtT(t), sub: cuts.some((c) => c > t - every && c <= t) ? 'cut' : '' };
    });
    const name = `sheet-${i / 36 + 1}`;
    const png = await renderSheet(browser, server.origin, { dir: tmp, name, title: `${path.basename(video)} · every ${every}s · ${fmtT(i * every)}– · ${cuts.length} cuts`, tiles: part, columns: 6, tileWidth: tile, aspect: W / H });
    const dest = path.join(out, `${name}.png`);
    fs.renameSync(png, dest);
    sheets.push(dest);
  }
} finally {
  await browser.close();
  await server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

const result = {
  video: rel(video), width: W, height: H, fps, duration: Number(duration.toFixed(3)),
  cuts: cuts.map((t) => Number(t.toFixed(3))),
  shots: { count: shots.length, lengths: shots, median: sorted[Math.floor(sorted.length / 2)], min: sorted[0], max: sorted.at(-1), cutsPer10s: Number(((cuts.length / duration) * 10).toFixed(1)) },
  palette,
  motion: { meanPerFrame: Number((total / Math.max(1, n - 1)).toFixed(2)), stillShare: Number((still / Math.max(1, n - 1)).toFixed(2)) },
  sheets: sheets.map(rel),
};
fs.writeFileSync(path.join(out, 'cuts.json'), JSON.stringify(result, null, 2));
const summary = [
  `# Reference: ${path.basename(video)}`,
  '',
  `${W}x${H} @ ${fps.toFixed(2)} fps · ${duration.toFixed(1)} s`,
  '',
  `- Shots: ${shots.length} · median ${result.shots.median}s · range ${result.shots.min}–${result.shots.max}s · ${result.shots.cutsPer10s} cuts per 10 s`,
  `- Cuts at: ${cuts.map(fmtT).join(', ') || 'none (one continuous shot — morphs and camera moves instead of cuts)'}`,
  `- Palette (dark → light): ${palette.map((c) => `\`${c}\``).join(' ')}`,
  `- Motion: mean change ${result.motion.meanPerFrame}/frame · holds still ${(result.motion.stillShare * 100).toFixed(0)}% of frames`,
  '',
  '## Sheets',
  ...sheets.map((s) => `- \`${rel(s)}\``),
  '',
  'Write style_guide.md from what you see: palette roles in hex, type (faces, scale, case, tracking),',
  'shot lengths, transitions, camera, texture. Take the grammar, never the subjects, logos or copy.',
  '',
].join('\n');
fs.writeFileSync(path.join(out, 'summary.md'), summary);
console.log(summary);
