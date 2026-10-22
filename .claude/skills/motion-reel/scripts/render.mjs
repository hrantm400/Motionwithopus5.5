#!/usr/bin/env node
// render.mjs — turn a seek(t) composition into frames, sound and video.
//
//   node render.mjs <film> [options]
//
//   --format 16x9|9x16|all    which format(s) to render (default: the film's first)
//   --scale 0.5               animatic at half size, written as *-animatic.mp4
//   --from 4 --to 7           only these seconds — re-check a fix in seconds, not minutes
//   --stills shots            PNG stills + labeled sheet instead of video
//            every:0.5 | 1,2.5,7
//   --guides                  draw title-safe / platform zones on stills
//   --lossless                capture PNG frames (slow) instead of JPEG q95 (default)
//   --workers 3               parallel Chromium pages (default: cores − 1, max 4)
//   --crf 18 --preset medium  x264 quality/speed
//   --no-audio                skip the soundtrack
//   --lufs -14                loudness target for the mix
//   --strict                  fail when seek() breaks the render contract
//   --out file.mp4            explicit output path (single format)
//
// Every frame is drawn by seeking the composition to t = frame / fps. Frames
// are independent, so several pages render in parallel and an ordered writer
// feeds them to one ffmpeg encoder.

import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  parseArgs, resolveFilm, startServer, loadChromium, launchBrowser, openFilm, captureFrame,
  run, checkTools, hasFilter, cpuCount, die, RUNTIME_DIR, stamp, ROOT,
} from './lib/studio.mjs';
import { renderSheet } from './lib/sheet.mjs';

const args = parseArgs();
checkTools();
const film = resolveFilm(args._[0]);
const rel = (p) => path.relative(ROOT, p);
const fmtT = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;

const server = await startServer();
const chromium = await loadChromium();
const browsers = [await launchBrowser(chromium)];
let exitCode = 0;

try {
  const probe = await openFilm(browsers[0], server.origin, film, args.format && args.format !== 'all' ? { format: args.format } : {});
  const info = probe.info;
  await probe.context.close();
  if (probe.errors.length) die(`The composition logged errors while loading:\n  ${probe.errors.slice(0, 8).join('\n  ')}`);
  if (info.missing.length) die(`Missing assets — a blocker, not something to fake:\n  ${info.missing.join('\n  ')}`);

  const formats = args.format === 'all' ? Object.keys(info.formats) : [args.format || info.format];
  for (const f of formats) if (!info.formats[f]) die(`Format "${f}" is not declared. This film has: ${Object.keys(info.formats).join(', ')}`);
  if (args.out && formats.length > 1) die('--out works with a single --format');

  const fps = Number(args.fps || info.fps);
  const scale = Number(args.scale || 1);
  const from = args.from !== undefined ? Math.max(0, Number(args.from)) : 0;
  const to = args.to !== undefined ? Math.min(Number(args.to), info.duration) : info.duration;
  if (!(to > from)) die(`Empty range: --from ${from} --to ${to}`);
  const shotAt = (t) => (info.timeline.shots || []).find((s) => t >= s.start && t < s.end)?.name || '';

  if (args.stills) {
    for (const format of formats) await renderStills(format);
  } else {
    const audio = args['no-audio'] || !info.audio ? null : await renderAudio();
    for (const format of formats) await renderVideo(format, audio);
  }

  // ── stills ────────────────────────────────────────────────────────────────

  async function renderStills(format) {
    const sess = await openFilm(browsers[0], server.origin, film, { format, guides: !!args.guides });
    const shots = info.timeline.shots || [];
    let times;
    const spec = String(args.stills);
    if (spec === 'shots' || spec === 'true') {
      times = shots.length ? shots.map((s) => s.start + (s.end - s.start) * 0.7) : null;
      if (!times) { times = []; for (let t = 0; t < info.duration; t += 1) times.push(t); }
    } else if (spec.startsWith('every:')) {
      const step = Number(spec.slice(6));
      times = [];
      for (let t = 0; t < info.duration - 1e-9; t += step) times.push(Math.round(t * 1000) / 1000);
    } else {
      times = spec.split(',').map(Number).filter((t) => t >= 0 && t <= info.duration);
    }
    const dir = path.join(film.reviews, `stills-${format}-${stamp()}`);
    fs.mkdirSync(dir, { recursive: true });
    const tiles = [];
    for (const t of times) {
      const file = path.join(dir, `t${t.toFixed(3).padStart(7, '0')}.png`);
      fs.writeFileSync(file, await captureFrame(sess, t, { type: 'png' }));
      tiles.push({ file, label: fmtT(t), sub: shotAt(t) });
    }
    await sess.context.close();
    const portrait = info.formats[format][1] > info.formats[format][0];
    const sheet = await renderSheet(browsers[0], server.origin, {
      dir, name: 'sheet', title: `${film.slug} · ${format} · ${tiles.length} stills`, tiles,
      columns: portrait ? 6 : 4, tileWidth: portrait ? 260 : 440, aspect: info.formats[format][0] / info.formats[format][1],
    });
    console.log(`✔ stills ${format}: ${tiles.length} PNGs in ${rel(dir)}\n  sheet: ${rel(sheet)}`);
  }

  // ── audio ─────────────────────────────────────────────────────────────────

  async function renderAudio() {
    const tmp = path.join(film.out, '.tmp');
    fs.mkdirSync(tmp, { recursive: true });
    const inputs = [];
    const t0 = performance.now();
    if (info.audio.score) {
      const scorePath = path.resolve(film.src, info.audio.score);
      if (!fs.existsSync(scorePath)) die(`Score module not found: ${rel(scorePath)}`);
      const synth = await import(pathToFileURL(path.join(RUNTIME_DIR, 'synth.mjs')).href);
      const mod = await import(pathToFileURL(scorePath).href);
      const mix = await mod.default({ duration: info.duration, sampleRate: synth.SAMPLE_RATE });
      if (!mix || !mix.left) die(`${rel(scorePath)} must return the mix from createMix() (after master()).`);
      const file = path.join(tmp, 'score.wav');
      fs.writeFileSync(file, synth.toWav(mix));
      inputs.push({ file, gain: info.audio.scoreGain || 0, offset: 0 });
    }
    if (info.audio.track) {
      const file = path.resolve(film.src, info.audio.track);
      if (!fs.existsSync(file)) die(`Audio track not found: ${rel(file)} — supply it in assets/ or drop audio.track.`);
      inputs.push({ file, gain: info.audio.trackGain || 0, offset: info.audio.trackOffset || 0 });
    }
    if (!inputs.length) return null;
    const raw = path.join(tmp, 'mix-raw.wav');
    const chains = inputs.map((inp, k) => `[${k}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=start=${inp.offset},asetpts=PTS-STARTPTS,volume=${inp.gain}dB,apad[a${k}]`);
    const mixer = inputs.length > 1 ? `${inputs.map((_, k) => `[a${k}]`).join('')}amix=inputs=${inputs.length}:normalize=0:duration=longest[m]` : '[a0]anull[m]';
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inputs.flatMap((i) => ['-i', i.file]),
      '-filter_complex', `${chains.join(';')};${mixer};[m]atrim=0:${info.duration}[out]`, '-map', '[out]', '-c:a', 'pcm_f32le', raw]);
    const lufs = Number(args.lufs ?? info.audio.lufs ?? -14);
    const { err } = await run('ffmpeg', ['-hide_banner', '-i', raw, '-af', `loudnorm=I=${lufs}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
    const m = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1));
    const file = path.join(tmp, 'mix.wav');
    if (!Number.isFinite(Number(m.input_i))) {
      fs.copyFileSync(raw, file);
      console.log('! audio is silent — nothing to normalize');
    } else {
      await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-af',
        `loudnorm=I=${lufs}:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`,
        '-c:a', 'pcm_s24le', file]);
    }
    console.log(`♪ audio: ${inputs.map((i) => path.basename(i.file)).join(' + ')} → ${lufs} LUFS (was ${m.input_i}) in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    return { file };
  }

  // ── video ─────────────────────────────────────────────────────────────────

  async function renderVideo(format, audio) {
    const workers = Math.max(1, Math.min(Number(args.workers || Math.min(4, cpuCount() - 1)), 8));
    while (browsers.length < workers) browsers.push(await launchBrowser(chromium));
    const sessions = await Promise.all(browsers.slice(0, workers).map((b) => openFilm(b, server.origin, film, { format, scale })));
    for (const s of sessions) if (s.errors.length) die(`Composition errors in ${format}:\n  ${s.errors.slice(0, 8).join('\n  ')}`);
    const [w, h] = await sessions[0].page.evaluate(() => [innerWidth, innerHeight]);

    const first = Math.round(from * fps);
    const last = Math.round(to * fps);
    const n = last - first;
    const partial = from > 0 || to < info.duration;
    const suffix = partial ? `-${from}-${to}` : scale !== 1 ? '-animatic' : '';
    const outFile = args.out ? path.resolve(args.out) : path.join(film.out, `${film.slug}-${format}${suffix}.mp4`);
    const type = args.lossless ? 'png' : 'jpeg';

    // Color: the page paints sRGB; the file is tagged bt709. zscale converts
    // within ±3 levels and is fast; plain swscale drifts ~4–5 levels, so the
    // fallback goes through RGB with accurate rounding (slower, as precise).
    const toYuv = hasFilter('zscale')
      ? (type === 'png' ? 'zscale=matrix=709:range=limited,format=yuv420p' : 'zscale=matrixin=170m:rangein=full:matrix=709:range=limited,format=yuv420p')
      : 'scale=flags=accurate_rnd+full_chroma_int,format=rgb24,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd,format=yuv420p';
    const ffArgs = ['-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', type === 'png' ? 'png' : 'mjpeg', '-i', '-'];
    if (audio) ffArgs.push('-ss', String(from), '-t', String(to - from), '-i', audio.file);
    ffArgs.push('-map', '0:v');
    if (audio) ffArgs.push('-map', '1:a', '-c:a', 'aac', '-b:a', '192k');
    ffArgs.push('-vf', toYuv,
      '-c:v', 'libx264', '-preset', String(args.preset || 'medium'), '-crf', String(args.crf || 18), '-tune', 'animation',
      '-profile:v', 'high', '-g', String(fps * 2), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-movflags', '+faststart', outFile);

    const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', (d) => (ffErr += d));
    ff.stdin.on('error', () => {});
    const ffDone = new Promise((resolve, reject) => ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed:\n${ffErr.slice(-1500)}`)))));

    // Workers pull frame numbers; the writer emits them in order with a small
    // look-ahead window so memory stays flat on long films.
    const slots = new Array(n);
    const waiting = new Map();
    let next = 0, written = 0, spaceWaiters = [];
    const ahead = workers * 3;
    const t0 = performance.now();
    let lastLog = t0;
    const isTTY = process.stdout.isTTY;
    const logProgress = (done) => {
      const now = performance.now();
      const fpsNow = done / ((now - t0) / 1000);
      const quarter = Math.floor((done / n) * 4) > Math.floor(((done - 1) / n) * 4);
      if (isTTY && now - lastLog > 250) {
        process.stdout.write(`\r  ${format} ▸ ${done}/${n} frames · ${fpsNow.toFixed(1)} fps · eta ${Math.ceil((n - done) / fpsNow)}s   `);
        lastLog = now;
      } else if (!isTTY && quarter && done < n) {
        console.log(`  ${format} ▸ ${done}/${n} frames · ${fpsNow.toFixed(1)} fps`);
      }
    };

    async function worker(sess) {
      for (;;) {
        const i = next++;
        if (i >= n) return;
        while (i - written >= ahead) await new Promise((r) => spaceWaiters.push(r));
        const buf = await captureFrame(sess, (first + i) / fps, { type });
        slots[i] = buf;
        const r = waiting.get(i);
        if (r) { waiting.delete(i); r(); }
      }
    }
    async function writer() {
      for (let i = 0; i < n; i++) {
        if (!slots[i]) await new Promise((r) => waiting.set(i, r));
        const buf = slots[i];
        slots[i] = null;
        if (!ff.stdin.write(buf)) await Promise.race([once(ff.stdin, 'drain'), ffDone]);
        written = i + 1;
        const ws = spaceWaiters;
        spaceWaiters = [];
        ws.forEach((r) => r());
        logProgress(written);
      }
      ff.stdin.end();
    }
    await Promise.race([Promise.all([writer(), ...sessions.map(worker)]), ffDone.then(() => { if (written < n) throw new Error('ffmpeg exited early'); })]);
    await ffDone;
    if (isTTY) process.stdout.write('\r' + ' '.repeat(70) + '\r');
    const secs = (performance.now() - t0) / 1000;

    // Poster frame: lossless PNG at the film's chosen moment.
    let posterFile = null;
    if (!partial && scale === 1) {
      const shots = info.timeline.shots || [];
      const tp = info.poster ?? (shots.length ? (shots.at(-1).start + shots.at(-1).end) / 2 : info.duration / 2);
      posterFile = path.join(film.out, `${film.slug}-${format}-poster.png`);
      fs.writeFileSync(posterFile, await captureFrame(sessions[0], tp, { type: 'png' }));
    }

    // Contract check: anything in seek() that reads the clock or the dice.
    const totals = {};
    for (const s of sessions) {
      const v = await s.page.evaluate(() => window.__film.violations);
      for (const [k, c] of Object.entries(v)) totals[k] = (totals[k] || 0) + c;
    }
    await Promise.all(sessions.map((s) => s.context.close()));
    const seekBreaks = Object.entries(totals).filter(([k, c]) => c > 0 && k !== 'Math.random in setup');
    const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
    console.log(`✔ ${rel(outFile)} · ${n} frames · ${w}x${h}@${fps} · ${(n / fps).toFixed(2)}s · ${mb} MB · ${secs.toFixed(1)}s (${(n / secs).toFixed(1)} fps, ${workers} workers, ${type})`);
    if (posterFile) console.log(`  poster: ${rel(posterFile)}`);
    if (totals['Math.random in setup']) console.log(`  note: Math.random used ${totals['Math.random in setup']}× in setup — the runtime seeds it, but prefer rng(seed) from motion.mjs`);
    if (seekBreaks.length) {
      console.log(`  ✖ render-contract violations inside seek(): ${seekBreaks.map(([k, c]) => `${k}×${c}`).join(', ')}`);
      console.log('    The picture must depend on t alone: use hash01()/noise1() instead of Math.random, and no timers or clocks.');
      if (args.strict) exitCode = 1;
    }
  }
} catch (err) {
  console.error(`\n✖ ${err.message}`);
  exitCode = 1;
} finally {
  await Promise.all(browsers.map((b) => b.close().catch(() => {})));
  await server.close();
}
process.exit(exitCode);
