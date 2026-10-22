#!/usr/bin/env node
// review.mjs — build the evidence the critic judges, from the exported file.
//
//   node review.mjs <film> [--format 16x9] [--video path.mp4] [--every 0.5] [--no-determinism]
//
// Writes films/<film>/reviews/rNN-<format>/:
//   contact-*.png  one frame every 0.5 s, 6 across, labeled with time and shot
//   strip.png      12 consecutive frames around the fastest move
//   phone.png      one frame per shot at 360 px wide (platform zones on vertical)
//   seam.png       last 6 frames, then first 6: does the loop pop?
//   signals.png    shots, cues, motion energy, audio envelope and onsets on one clock
//   loop.mp4       the clip twice back to back
//   report.md      numbers + automatic flags (dead beats, silence, unsynced cues,
//                  loudness, determinism, contract lint)
//   critique.md    the scoring template the critic fills in
// Nothing here judges taste. It makes the defects visible so the critic can.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  parseArgs, resolveFilm, startServer, loadChromium, launchBrowser, openFilm, captureFrame,
  run, runBinary, checkTools, die, ROOT,
} from './lib/studio.mjs';
import { renderSheet, renderSignals } from './lib/sheet.mjs';

const args = parseArgs();
checkTools();
const film = resolveFilm(args._[0]);
const rel = (p) => path.relative(ROOT, p);
const fmtT = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// 20 ms RMS windows every 5 ms, in dBFS.
function energy(sig, sr) {
  const hop = Math.round(sr * 0.005), win = Math.round(sr * 0.02);
  const dbs = [];
  for (let i = 0; i + win <= sig.length; i += hop) {
    let s = 0;
    for (let k = i; k < i + win; k++) s += sig[k] * sig[k];
    dbs.push(10 * Math.log10(s / win + 1e-12));
  }
  return { dbs, hop, win };
}
// An onset is a jump of 8 dB over the loudest of the previous 10–30 ms.
function detectOnsets({ dbs, hop, win }, sr) {
  const out = [];
  let last = -1;
  for (let i = 6; i < dbs.length; i++) {
    let before = -Infinity;
    for (let k = i - 6; k <= i - 2; k++) before = Math.max(before, dbs[k]);
    const t = (i * hop + win - hop / 2) / sr;
    if (dbs[i] - before > 8 && dbs[i] > -45 && t - last > 0.06) { out.push(t); last = t; }
  }
  return out;
}

const server = await startServer();
const browser = await launchBrowser(await loadChromium());
let exitCode = 0;

try {
  const sess = await openFilm(browser, server.origin, film, args.format ? { format: args.format } : {});
  const info = sess.info;
  const format = info.format;
  const video = args.video ? path.resolve(args.video) : path.join(film.out, `${film.slug}-${format}.mp4`);
  if (!fs.existsSync(video)) die(`No export at ${rel(video)}. Render first: node render.mjs ${film.slug} --format ${format}`);

  const rounds = fs.readdirSync(film.reviews).map((d) => /^r(\d+)-/.exec(d)).filter(Boolean).map((m) => Number(m[1]));
  const round = (rounds.length ? Math.max(...rounds) : 0) + 1;
  const dir = path.join(film.reviews, `r${String(round).padStart(2, '0')}-${format}`);
  const tmp = path.join(dir, '.frames');
  fs.mkdirSync(tmp, { recursive: true });

  // ── the file itself ───────────────────────────────────────────────────────
  const { out: probeOut } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', video]);
  const pj = JSON.parse(probeOut);
  const vs = pj.streams.find((s) => s.codec_type === 'video');
  const hasAudio = pj.streams.some((s) => s.codec_type === 'audio');
  const [fn, fd] = vs.r_frame_rate.split('/').map(Number);
  const fps = fn / (fd || 1);
  const W = vs.width, H = vs.height;
  const duration = Number(pj.format.duration);
  const portrait = H > W;
  const shots = info.timeline.shots || [];
  const cues = info.timeline.cues || [];
  const shotAt = (t) => shots.find((s) => t >= s.start && t < s.end)?.name || '';
  const tile = portrait ? 180 : W === H ? 240 : 320;

  // Extract a set of frame numbers at a given width, return their files.
  async function frames(nums, width, prefix) {
    const uniq = [...new Set(nums.filter((n) => n >= 0 && n < Math.round(duration * fps)))].sort((a, b) => a - b);
    const files = [];
    for (let i = 0; i < uniq.length; i += 40) {
      const batch = uniq.slice(i, i + 40);
      const sel = batch.map((n) => `eq(n\\,${n})`).join('+');
      await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-vf', `select=${sel},scale=${width}:-2:flags=lanczos`, '-fps_mode', 'vfr', '-q:v', '2', path.join(tmp, `${prefix}-${i}-%03d.jpg`)]);
      batch.forEach((n, k) => files.push({ n, t: n / fps, file: path.join(tmp, `${prefix}-${i}-${String(k + 1).padStart(3, '0')}.jpg`) }));
    }
    return files;
  }
  const evidence = [];
  const flags = [];

  // ── contact sheet ─────────────────────────────────────────────────────────
  const every = Number(args.every || 0.5);
  const contactNums = [];
  for (let t = 0; t < duration - 1e-6; t += every) contactNums.push(Math.round(t * fps));
  const contact = await frames(contactNums, tile, 'c');
  const perSheet = 36;
  for (let i = 0; i < contact.length; i += perSheet) {
    const part = contact.slice(i, i + perSheet);
    const name = contact.length > perSheet ? `contact-${i / perSheet + 1}` : 'contact';
    evidence.push(await renderSheet(browser, server.origin, {
      dir: tmp, name, title: `${film.slug} · ${format} · contact sheet · every ${every}s · ${fmtT(part[0].t)}–${fmtT(part.at(-1).t)} · r${round}`,
      tiles: part.map((f) => ({ file: f.file, label: fmtT(f.t), sub: shotAt(f.t) })), columns: 6, tileWidth: tile, aspect: W / H,
    }));
  }

  // ── motion energy ─────────────────────────────────────────────────────────
  const mw = 96, mh = Math.max(2, Math.round((mw * H) / W / 2) * 2);
  const gray = await runBinary('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', `scale=${mw}:${mh}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
  const fsz = mw * mh;
  const nFrames = Math.floor(gray.length / fsz);
  const motion = new Float64Array(nFrames);
  for (let i = 1; i < nFrames; i++) {
    let s = 0;
    const a = (i - 1) * fsz, b = i * fsz;
    for (let k = 0; k < fsz; k++) s += Math.abs(gray[b + k] - gray[a + k]);
    motion[i] = s / fsz;
  }
  const smooth = motion.map((_, i) => { let s = 0, c = 0; for (let k = i - 2; k <= i + 2; k++) if (k >= 0 && k < nFrames) { s += motion[k]; c++; } return s / c; });
  const med = median([...motion].slice(1));
  const cuts = [];
  for (let i = 1; i < nFrames; i++) if (motion[i] > Math.max(12, med * 8)) cuts.push(i / fps);
  // static stretches: no visible change for ≥ 3 s
  const STILL = 0.06, MIN_STILL = 3;
  for (let i = 1, start = -1; i <= nFrames; i++) {
    const still = i < nFrames && smooth[i] < STILL;
    if (still && start < 0) start = i;
    if (!still && start >= 0) {
      const t0 = start / fps, t1 = i / fps;
      if (t1 - t0 >= MIN_STILL) flags.push({ kind: 'static', start: t0, end: t1, row: 'motion', label: `static ${(t1 - t0).toFixed(1)}s`, note: `Nothing on screen changes for ${(t1 - t0).toFixed(1)}s (${fmtT(t0)}–${fmtT(t1)}). Intentional hold for reading, or a dead beat?` });
      start = -1;
    }
  }

  // ── strip around the fastest sustained move ───────────────────────────────
  let peak = 6;
  for (let i = 6; i < nFrames - 6; i++) if (smooth[i] > smooth[peak]) peak = i;
  const stripNums = Array.from({ length: 12 }, (_, k) => peak - 6 + k);
  const strip = await frames(stripNums, portrait ? 240 : 420, 's');
  evidence.push(await renderSheet(browser, server.origin, {
    dir: tmp, name: 'strip', title: `${film.slug} · ${format} · 12 consecutive frames around the fastest move (${fmtT(peak / fps)}) · r${round}`,
    tiles: strip.map((f) => ({ file: f.file, label: `f${f.n}`, sub: fmtT(f.t) })), columns: 6, tileWidth: portrait ? 240 : 420, aspect: W / H,
  }));

  // ── phone test ────────────────────────────────────────────────────────────
  const keyTimes = shots.length ? shots.map((s) => s.start + (s.end - s.start) * 0.7) : Array.from({ length: Math.ceil(duration) }, (_, i) => i + 0.5).filter((t) => t < duration);
  const phone = await frames(keyTimes.map((t) => Math.round(t * fps)), 360, 'p');
  evidence.push(await renderSheet(browser, server.origin, {
    dir: tmp, name: 'phone', title: `${film.slug} · ${format} · phone test: 360 px wide, actual size${portrait ? ' · red = platform UI' : ''} · r${round}`,
    tiles: phone.map((f) => ({ file: f.file, label: fmtT(f.t), sub: shotAt(f.t) })), columns: portrait ? 5 : 4, tileWidth: 360, aspect: W / H, overlay: portrait ? 'portrait-safe' : null,
  }));

  // ── loop seam ─────────────────────────────────────────────────────────────
  const tailNums = Array.from({ length: 6 }, (_, k) => nFrames - 6 + k);
  const headNums = Array.from({ length: 6 }, (_, k) => k);
  const seamFiles = await frames([...tailNums, ...headNums], tile, 'l');
  const seamTiles = [...tailNums, ...headNums].map((n) => seamFiles.find((f) => f.n === n)).filter(Boolean);
  evidence.push(await renderSheet(browser, server.origin, {
    dir: tmp, name: 'seam', title: `${film.slug} · ${format} · loop seam: last 6 frames → first 6 · r${round}`,
    tiles: seamTiles.map((f) => ({ file: f.file, label: `f${f.n}`, sub: f.n >= nFrames - 6 ? 'end' : 'start', mark: f.n === nFrames - 1 || f.n === 0 })), columns: 6, tileWidth: tile, aspect: W / H,
  }));
  let seamJump = 0;
  { const a = (nFrames - 1) * fsz; for (let k = 0; k < fsz; k++) seamJump += Math.abs(gray[k] - gray[a + k]); seamJump /= fsz; }
  const typicalMove = Math.max(0.3, median([...smooth].filter((v) => v > STILL)));
  if (info.loop && seamJump > typicalMove * 4) flags.push({ kind: 'loop', start: duration - 0.2, end: duration, row: 'motion', label: 'loop pop', note: `Loop seam jumps ${seamJump.toFixed(1)} vs typical motion ${typicalMove.toFixed(1)} per frame: the last frame does not lead into the first.` });
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-stream_loop', '1', '-i', video, '-c', 'copy', path.join(dir, 'loop.mp4')]);

  // ── audio ─────────────────────────────────────────────────────────────────
  const audio = { present: hasAudio };
  let envelope = [], onsets = [];
  let transientNear, swellNear;
  if (hasAudio) {
    const { err } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', video, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    const summary = err.slice(err.lastIndexOf('Summary:'));
    const num = (re) => { const m = re.exec(summary); return m ? Number(m[1]) : null; };
    audio.lufs = num(/I:\s+(-?[\d.]+) LUFS/);
    audio.lra = num(/LRA:\s+(-?[\d.]+) LU/);
    audio.truePeak = num(/Peak:\s+(-?[\d.]+) dBFS/);
    const SR = 16000;
    const pcm = await runBinary('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', video, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-']);
    const x = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4));
    const hi = new Float32Array(x.length);
    for (let i = 1; i < x.length; i++) hi[i] = x[i] - x[i - 1]; // crude high-pass: clicks and hats stand out over pads
    const full = energy(x, SR);
    const high = energy(hi, SR);
    envelope = full.dbs.filter((_, i) => i % 4 === 0).map((v, i) => ({ t: (i * 4 * full.hop + full.win / 2) / SR, v }));
    onsets = [...detectOnsets(full, SR), ...detectOnsets(high, SR)].sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1] > 0.03);
    // Is there a transient at time t? A local rise of ≥ 3 dB in either band, so
    // a click riding on a whoosh still counts.
    transientNear = (t, reach = 0.08) => {
      let best = null;
      for (const band of [full, high]) {
        const i0 = Math.max(6, Math.floor(((t - reach) * SR - band.win) / band.hop));
        const i1 = Math.min(band.dbs.length - 1, Math.ceil(((t + reach) * SR - band.win) / band.hop));
        for (let i = i0; i <= i1; i++) {
          let before = -Infinity;
          for (let k = i - 6; k <= i - 2; k++) before = Math.max(before, band.dbs[k]);
          const rise = band.dbs[i] - before;
          const ti = (i * band.hop + band.win - band.hop / 2) / SR;
          if (rise >= 3 && band.dbs[i] > -50 && (!best || Math.abs(ti - t) < Math.abs(best.t - t))) best = { t: ti, rise };
        }
      }
      return best;
    };
    // ...or the peak of a swell (a whoosh that crests on the cut): a local
    // maximum at least 6 dB above where the sound was 150–400 ms earlier.
    swellNear = (t, reach = 0.08) => {
      const idx = (tt) => Math.max(0, Math.min(full.dbs.length - 1, Math.round((tt * SR - full.win / 2) / full.hop)));
      let peak = -Infinity, at = t;
      for (let i = idx(t - reach); i <= idx(t + reach); i++) if (full.dbs[i] > peak) { peak = full.dbs[i]; at = (i * full.hop + full.win / 2) / SR; }
      let floor = Infinity;
      for (let i = idx(t - 0.4); i <= idx(t - 0.15); i++) floor = Math.min(floor, full.dbs[i]);
      const after = full.dbs[idx(t + 0.2)];
      return peak - floor >= 6 && peak > -50 && peak >= after ? { t: at, rise: peak - floor } : null;
    };
    // silence
    for (let i = 0, start = -1; i <= envelope.length; i++) {
      const quiet = i < envelope.length && envelope[i].v < -50;
      if (quiet && start < 0) start = envelope[i].t;
      if (!quiet && start >= 0) {
        const end = i < envelope.length ? envelope[i].t : duration;
        if (end - start >= 1) flags.push({ kind: 'silence', start, end, row: 'audio', label: `silence ${(end - start).toFixed(1)}s`, note: `No sound for ${(end - start).toFixed(1)}s (${fmtT(start)}–${fmtT(end)}).` });
        start = -1;
      }
    }
    // sync: every timeline cue and every hard cut should have a sound on it
    const events = [...cues.map((c) => ({ t: c.t, label: c.label || 'cue' })), ...cuts.filter((t) => !cues.some((c) => Math.abs(c.t - t) < 0.1)).map((t) => ({ t, label: 'cut' }))];
    const offsets = [];
    audio.unsynced = [];
    for (const e of events) {
      const hit = transientNear(e.t) || swellNear(e.t);
      if (hit) { offsets.push(hit.t - e.t); continue; }
      const near = onsets.reduce((best, o) => (Math.abs(o - e.t) < Math.abs(best - e.t) ? o : best), Infinity);
      audio.unsynced.push({ t: e.t, label: e.label, nearestOnsetMs: Number.isFinite(near) ? Math.round((near - e.t) * 1000) : null });
    }
    audio.events = events.length;
    audio.syncedEvents = offsets.length;
    audio.medianOffsetMs = offsets.length ? Math.round(median(offsets) * 1000) : null;
    audio.onsets = onsets.length;
    if (audio.lufs !== null && Math.abs(audio.lufs + 14) > 1.5) flags.push({ kind: 'loudness', start: 0, end: 0, row: 'audio', label: '', note: `Integrated loudness ${audio.lufs} LUFS; target is -14 ±1.` });
    if (audio.truePeak !== null && audio.truePeak > -0.5) flags.push({ kind: 'peak', start: 0, end: 0, row: 'audio', label: '', note: `True peak ${audio.truePeak} dBFS — leave at least 1 dB of headroom.` });
    for (const u of audio.unsynced.slice(0, 12)) flags.push({ kind: 'sync', start: u.t, end: u.t + 0.05, row: 'audio', label: '', note: `${u.label} at ${fmtT(u.t)} has no sound within 80 ms${u.nearestOnsetMs !== null ? ` (nearest onset ${u.nearestOnsetMs > 0 ? '+' : ''}${u.nearestOnsetMs} ms)` : ''}.` });
  } else {
    flags.push({ kind: 'audio', start: 0, end: 0, row: 'audio', label: '', note: 'The export has no audio stream. Silent films feel unfinished; add a score (score.mjs) or a supplied track.' });
  }

  evidence.push(await renderSignals(browser, server.origin, {
    dir: tmp, name: 'signals', title: `${film.slug} · ${format} · signals: shots / motion energy / audio envelope + onsets (green) / cues (amber) · r${round}`,
    duration, shots, cues, motion: [...smooth].map((v, i) => ({ t: i / fps, v })).filter((_, i) => i % Math.max(1, Math.round(fps / 30)) === 0),
    audio: envelope, onsets, flags: flags.filter((f) => f.end > f.start),
  }));

  // ── determinism: the same frame three ways must be byte-identical ─────────
  const det = { checked: !args['no-determinism'] };
  if (det.checked) {
    const n = Math.min(300, Math.floor((info.duration * info.fps) / 2));
    const t = n / info.fps;
    const hash = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
    const a = await captureFrame(sess, t, { type: 'png' });
    for (const other of [info.duration * 0.9, 0, info.duration * 0.37, t + 0.5]) await captureFrame(sess, Math.min(other, info.duration), { type: 'png' });
    const b = await captureFrame(sess, t, { type: 'png' });
    const fresh = await openFilm(browser, server.origin, film, { format });
    const c = await captureFrame(fresh, t, { type: 'png' });
    const v = await sess.page.evaluate(() => window.__film.violations);
    await fresh.context.close();
    Object.assign(det, { frame: n, t, fresh: hash(a), afterOtherFrames: hash(b), freshPage: hash(c), violations: v });
    const identical = det.fresh === det.afterOtherFrames && det.fresh === det.freshPage;
    // How different? A handful of pixels a few levels apart is Chromium's
    // compositor (layer raster caching), not the composition; anything more
    // is a real leak.
    const diff = async (x, y) => {
      if (hash(x) === hash(y)) return { pixels: 0, maxDelta: 0 };
      const fa = path.join(tmp, 'det-x.png'), fb = path.join(tmp, 'det-y.png');
      fs.writeFileSync(fa, x);
      fs.writeFileSync(fb, y);
      const ra = await runBinary('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', fa, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
      const rb = await runBinary('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', fb, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
      let pixels = 0, maxDelta = 0;
      for (let i = 0; i < Math.min(ra.length, rb.length); i += 3) {
        const d = Math.max(Math.abs(ra[i] - rb[i]), Math.abs(ra[i + 1] - rb[i + 1]), Math.abs(ra[i + 2] - rb[i + 2]));
        if (d) { pixels++; maxDelta = Math.max(maxDelta, d); }
      }
      return { pixels, maxDelta };
    };
    det.history = await diff(a, b);
    det.pages = await diff(a, c);
    const noise = (d) => d.pixels <= 50 && d.maxDelta <= 24;
    det.pass = identical || (noise(det.history) && noise(det.pages));
    det.note = identical ? 'byte-identical' : det.pass ? `raster noise only: ${det.history.pixels + det.pages.pixels} px, max Δ${Math.max(det.history.maxDelta, det.pages.maxDelta)}` : '';
    if (!det.pass) {
      fs.writeFileSync(path.join(dir, `det-f${n}-a.png`), a);
      fs.writeFileSync(path.join(dir, `det-f${n}-b.png`), b);
      fs.writeFileSync(path.join(dir, `det-f${n}-c.png`), c);
      const leak = !noise(det.history);
      const d = leak ? det.history : det.pages;
      const why = leak ? 'seek() depends on which frames were drawn before (state leaks between frames)' : 'two fresh pages disagree (setup reads time, randomness or async order)';
      flags.unshift({ kind: 'determinism', start: t, end: t, row: 'motion', label: '', note: `Frame ${n} differs when rendered twice (${d.pixels} px, max Δ${d.maxDelta}): ${why}. Compare det-f${n}-a.png (fresh) with -b (after other frames) and -c (fresh page).` });
    }
  }
  await sess.context.close();

  // ── static lint of the render contract ────────────────────────────────────
  const lint = [];
  const RULES = [
    [/Math\.random\s*\(/, 'Math.random — use rng(seed) in setup or hash01()/noise1() in seek()'],
    [/requestAnimationFrame\s*\(|setTimeout\s*\(|setInterval\s*\(/, 'timer — nothing may drive the picture except seek(t)'],
    [/Date\.now\s*\(|new Date\s*\(|performance\.now\s*\(/, 'clock — the picture must depend on t alone'],
    [/(^|[;{\s])(transition|animation)\s*:|@keyframes/, 'CSS animation/transition — disabled at render time, so this motion silently disappears'],
    [/\.play\s*\(|autoplay/, 'media playback — seek video by setting currentTime from t, or pre-extract frames'],
    [/(src|href)\s*=\s*["']https?:\/\/|url\(\s*["']?https?:\/\/|import\s.*from\s+["']https?:\/\//, 'remote asset — copy it into assets/ so renders work offline and never change'],
  ];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const file of walk(film.src).filter((f) => /\.(html|m?js|css)$/.test(f))) {
    const isScore = /score\.mjs$/.test(file);
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      for (const [re, msg] of RULES) if (re.test(line) && !(isScore && /timer|clock/.test(msg))) lint.push({ file: rel(file), line: i + 1, msg, code: trimmed.slice(0, 120) });
    });
  }

  // ── report ────────────────────────────────────────────────────────────────
  const finalEvidence = [];
  for (const f of evidence) {
    const dest = path.join(dir, path.basename(f));
    fs.renameSync(f, dest);
    finalEvidence.push(dest);
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  const report = {
    film: film.slug, format, round, video: rel(video), width: W, height: H, fps, duration,
    shots, cues: cues.length, cuts, motion: { median: Number(med.toFixed(3)), peakAt: Number((peak / fps).toFixed(3)), seamJump: Number(seamJump.toFixed(2)) },
    audio, determinism: det, lint, flags: flags.map(({ kind, start, end, note }) => ({ kind, start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), note })),
    evidence: finalEvidence.map(rel),
  };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));

  const lines = [
    `# Review r${round} · ${film.slug} · ${format}`,
    '',
    `Video: \`${rel(video)}\` · ${W}x${H} @ ${fps} fps · ${duration.toFixed(2)} s`,
    '',
    '## Evidence (read every image before scoring)',
    ...finalEvidence.map((f) => `- \`${rel(f)}\``),
    `- \`${rel(path.join(dir, 'loop.mp4'))}\` (the clip twice)`,
    '',
    '## Measurements',
    `- Hard cuts: ${cuts.length ? cuts.map(fmtT).join(', ') : 'none'}`,
    `- Fastest move: ${fmtT(peak / fps)} · median motion ${med.toFixed(2)} · loop seam jump ${seamJump.toFixed(2)}${info.loop ? ' (film declares loop: true)' : ''}`,
    hasAudio
      ? `- Audio: ${audio.lufs} LUFS integrated · LRA ${audio.lra} LU · true peak ${audio.truePeak} dBFS · ${audio.onsets} onsets · ${audio.syncedEvents}/${audio.events} cues and cuts have a sound within 80 ms${audio.medianOffsetMs !== null ? ` (median offset ${audio.medianOffsetMs} ms)` : ''}`
      : '- Audio: none',
    det.checked ? `- Determinism: ${det.pass ? 'PASS' : 'FAIL'} — frame ${det.frame}: ${det.pass ? det.note : `after other frames ${det.history.pixels} px differ (max Δ${det.history.maxDelta}), fresh page ${det.pages.pixels} px (max Δ${det.pages.maxDelta})`}` : '- Determinism: skipped',
    '',
    '## Automatic flags',
    ...(flags.length ? flags.map((f) => `- **${f.kind}** — ${f.note}`) : ['- none']),
    '',
    '## Contract lint',
    ...(lint.length ? lint.map((l) => `- \`${l.file}:${l.line}\` ${l.msg}\n  \`${l.code}\``) : ['- clean']),
    '',
    '## Next',
    `Fill in \`${rel(path.join(dir, 'critique.md'))}\`: judge only these frames, not what you meant to make.`,
    '',
  ];
  fs.writeFileSync(path.join(dir, 'report.md'), lines.join('\n'));

  const critique = path.join(dir, 'critique.md');
  if (!fs.existsSync(critique)) {
    fs.writeFileSync(critique, [
      `# Critique r${round} · ${film.slug} · ${format}`,
      '',
      'Judge only the rendered frames and the measurements in report.md. Ignore what you meant to make.',
      '',
      '| criterion | score 1–10 | evidence (timestamp + what you see) |',
      '|---|---|---|',
      '| hook — the first 2 s earn attention | | |',
      '| phone readability — phone.png at 360 px | | |',
      '| motion — mass, easing, nothing slides or snaps wrong (strip.png) | | |',
      '| variety — something new every 2–4 s, no dead beats | | |',
      '| sound sync — hits on state changes, audio has its own shape | | |',
      '| brand accuracy — real assets, colors, type, nothing invented | | |',
      '',
      '## Three worst defects',
      '',
      '1. **[mm:ss.ss]** defect — evidence — local fix (which seconds, which property)',
      '2. ',
      '3. ',
      '',
      '## Fix log',
      '',
      '- ',
      '',
    ].join('\n'));
  }

  console.log(`✔ review r${round} · ${film.slug} · ${format} → ${rel(dir)}`);
  for (const f of finalEvidence) console.log(`  ${rel(f)}`);
  console.log(`  ${rel(path.join(dir, 'report.md'))}`);
  console.log(`  audio: ${hasAudio ? `${audio.lufs} LUFS · peak ${audio.truePeak} dBFS · ${audio.syncedEvents}/${audio.events} cues synced` : 'none'} · determinism: ${det.checked ? (det.pass ? `PASS (${det.note})` : 'FAIL') : 'skipped'} · lint: ${lint.length || 'clean'}`);
  if (flags.length) {
    console.log(`  flags (${flags.length}):`);
    for (const f of flags.slice(0, 10)) console.log(`   - ${f.kind}: ${f.note}`);
  }
  console.log(`  next: read the images, then fill ${rel(critique)}`);
} catch (err) {
  console.error(`\n✖ ${err.stack || err.message}`);
  exitCode = 1;
} finally {
  await browser.close().catch(() => {});
  await server.close();
}
process.exit(exitCode);
