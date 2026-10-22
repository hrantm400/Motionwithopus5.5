// sheet.mjs — evidence images for the critic: labeled frame grids and a
// signals chart (motion energy, audio envelope, shots, cues). Each is laid out
// as HTML and screenshotted with the same Chromium, so labels render the same
// on every machine and no font paths are needed.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './studio.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const urlFor = (file) => '/' + path.relative(ROOT, file).split(path.sep).join('/');

async function shoot(browser, origin, htmlFile, pngFile, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 400 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(origin + urlFor(htmlFile));
  await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))));
  await page.screenshot({ path: pngFile, fullPage: true, type: 'png' });
  await ctx.close();
  return pngFile;
}

/**
 * tiles: [{ file, label, sub, mark }] — mark highlights a tile (e.g. loop seam).
 * overlay: 'portrait-safe' draws the platform UI zones scaled onto each tile.
 */
export async function renderSheet(browser, origin, { dir, name, title, tiles, columns = 6, tileWidth = 320, aspect = 16 / 9, overlay = null }) {
  const tileH = Math.round(tileWidth / aspect);
  const gap = 10;
  const width = columns * tileWidth + (columns + 1) * gap;
  const s = tileWidth / 1080;
  const zones = overlay === 'portrait-safe'
    ? `<i class="z" style="left:0;top:0;width:100%;height:${220 * s}px"></i><i class="z" style="left:0;bottom:0;width:100%;height:${420 * s}px"></i><i class="z" style="right:0;top:${920 * s}px;width:${140 * s}px;height:${580 * s}px"></i>`
    : '';
  const cells = tiles.map((t) => `
    <figure class="${t.mark ? 'mark' : ''}">
      <div class="img" style="width:${tileWidth}px;height:${tileH}px"><img src="${esc(path.basename(t.file))}" width="${tileWidth}" height="${tileH}">${zones}</div>
      <figcaption><b>${esc(t.label)}</b>${t.sub ? ` <span>${esc(t.sub)}</span>` : ''}</figcaption>
    </figure>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#0e0e0e;color:#ddd;font:500 15px/1.3 ui-monospace,Menlo,Consolas,monospace}
    h1{font-size:16px;font-weight:600;margin:0;padding:${gap + 2}px ${gap}px 0;color:#fff}
    .grid{display:grid;grid-template-columns:repeat(${columns},${tileWidth}px);gap:${gap}px;padding:${gap}px}
    figure{margin:0}
    .img{position:relative;overflow:hidden;outline:1px solid #333;background:#000}
    .img img{display:block}
    .z{position:absolute;display:block;background:rgba(255,40,40,.18);outline:1px dashed rgba(255,80,80,.9)}
    figure.mark .img{outline:3px solid #ff3b30}
    figcaption{padding:5px 1px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    figcaption span{color:#9a9a9a}
  </style><h1>${esc(title)}</h1><div class="grid">${cells}</div>`;
  const htmlFile = path.join(dir, `${name}.html`);
  fs.writeFileSync(htmlFile, html);
  const png = await shoot(browser, origin, htmlFile, path.join(dir, `${name}.png`), width);
  fs.rmSync(htmlFile);
  return png;
}

/**
 * Signals chart: one shared time axis with shot bands, timeline cues, motion
 * energy (how much the picture changes per frame), the audio envelope and its
 * detected onsets, plus flagged ranges (dead beats, silence).
 */
export async function renderSignals(browser, origin, { dir, name = 'signals', title, duration, shots = [], cues = [], motion = [], audio = [], onsets = [], flags = [], width = 1800 }) {
  const padL = 70, padR = 20, W = width - padL - padR;
  const x = (t) => padL + (t / duration) * W;
  const rows = { shots: [30, 34], motion: [80, 150], audio: [250, 150], cues: [410, 30] };
  const H = 470;
  const maxM = Math.max(1e-6, ...motion.map((p) => p.v));
  const pathOf = (pts, [top, h], max, floor = 0) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${(top + h - (Math.max(0, p.v - floor) / (max - floor)) * h).toFixed(1)}`).join('');
  const audioFloor = -60;
  const audioPts = audio.map((p) => ({ t: p.t, v: Math.max(audioFloor, p.v) }));
  const audioPath = audioPts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${(rows.audio[0] + rows.audio[1] - ((p.v - audioFloor) / -audioFloor) * rows.audio[1]).toFixed(1)}`).join('');
  const ticks = [];
  const step = duration > 60 ? 10 : duration > 20 ? 2 : 1;
  for (let t = 0; t <= duration + 1e-6; t += step) ticks.push(`<line x1="${x(t)}" x2="${x(t)}" y1="20" y2="${H - 20}" class="grid"/><text x="${x(t)}" y="${H - 4}" class="ax">${t.toFixed(0)}s</text>`);
  const bands = shots.map((s, i) => `<rect x="${x(s.start)}" y="${rows.shots[0]}" width="${Math.max(1, x(s.end) - x(s.start))}" height="${rows.shots[1]}" class="${i % 2 ? 'b2' : 'b1'}"/><text x="${x(s.start) + 6}" y="${rows.shots[0] + 22}" class="lbl">${esc(s.name)}</text><line x1="${x(s.start)}" x2="${x(s.start)}" y1="${rows.shots[0]}" y2="${rows.cues[0] + rows.cues[1]}" class="cut"/>`).join('');
  const cueMarks = cues.map((c) => `<line x1="${x(c.t)}" x2="${x(c.t)}" y1="${rows.motion[0]}" y2="${rows.cues[0] + rows.cues[1]}" class="cue"/><text x="${x(c.t) + 3}" y="${rows.cues[0] + 22}" class="cl">${esc(c.label || '')}</text>`).join('');
  const onsetMarks = onsets.map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="${rows.audio[0] + rows.audio[1] - 18}" y2="${rows.audio[0] + rows.audio[1]}" class="on"/>`).join('');
  const flagRects = flags.map((f) => `<rect x="${x(f.start)}" y="${f.row === 'audio' ? rows.audio[0] : rows.motion[0]}" width="${Math.max(2, x(f.end) - x(f.start))}" height="${f.row === 'audio' ? rows.audio[1] : rows.motion[1]}" class="flag"/><text x="${x(f.start) + 4}" y="${(f.row === 'audio' ? rows.audio[0] : rows.motion[0]) + 16}" class="fl">${esc(f.label)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}">
    <style>
      .grid{stroke:#262626}.ax{fill:#888;font:12px ui-monospace,monospace;text-anchor:middle}
      .b1{fill:#1f2a33}.b2{fill:#26323d}.lbl{fill:#cfe3f5;font:600 13px ui-monospace,monospace}
      .cut{stroke:#5b7a95;stroke-dasharray:3 3}.cue{stroke:#f5a623;stroke-opacity:.55}
      .cl{fill:#f5a623;font:11px ui-monospace,monospace}.on{stroke:#7ee787;stroke-width:1.5}
      .m{fill:none;stroke:#e8e8e8;stroke-width:1.4}.a{fill:none;stroke:#7ee787;stroke-width:1.4}
      .flag{fill:#ff3b30;fill-opacity:.16;stroke:#ff3b30;stroke-opacity:.7}.fl{fill:#ff8a80;font:600 12px ui-monospace,monospace}
      .row{fill:#9a9a9a;font:600 12px ui-monospace,monospace}
    </style>
    <rect width="100%" height="100%" fill="#0e0e0e"/>
    ${ticks.join('')}${bands}${flagRects}
    <text x="8" y="${rows.shots[0] + 22}" class="row">shots</text>
    <text x="8" y="${rows.motion[0] + 14}" class="row">motion</text>
    <path d="${pathOf(motion, rows.motion, maxM)}" class="m"/>
    <text x="8" y="${rows.audio[0] + 14}" class="row">audio</text>
    <text x="8" y="${rows.audio[0] + 30}" class="row">dBFS</text>
    <path d="${audioPath}" class="a"/>${onsetMarks}
    <text x="8" y="${rows.cues[0] + 22}" class="row">cues</text>${cueMarks}
  </svg>`;
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0e0e0e;color:#fff;font:600 16px ui-monospace,Menlo,monospace}h1{font-size:16px;margin:0;padding:12px 12px 0}</style><h1>${esc(title)}</h1>${svg}`;
  const htmlFile = path.join(dir, `${name}.html`);
  fs.writeFileSync(htmlFile, html);
  const png = await shoot(browser, origin, htmlFile, path.join(dir, `${name}.png`), width);
  fs.rmSync(htmlFile);
  return png;
}
