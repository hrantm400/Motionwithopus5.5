// runtime.mjs — the film harness. Served at /_studio/runtime.mjs.
//
// Contract: the picture is a pure function of time. film.seek(t) paints exactly
// what the screen shows at second t, and nothing else drives the picture. The
// renderer calls it once per frame, in any order and in several pages at once,
// so frame 240 must never depend on frames 0–239 having been drawn.
//
//   ?render=1   render mode (no player UI, used by render.mjs)
//   ?format=9x16  pick one of the film's formats
//   ?scale=0.5  render at a fraction of full size (animatics)
//   ?guides=1   draw title-safe / platform-UI zones over the frame
//   #t=3.25     open the preview paused at 3.25 s

export const FORMATS = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '4x5': [1080, 1350] };

const params = new URLSearchParams(location.search);
const RENDER = params.get('render') === '1';

// ── determinism guards ──────────────────────────────────────────────────────
// Math.random becomes a seeded generator everywhere (so every render page lays
// out the same particles), and wall-clock APIs used inside seek() are counted
// and reported by the renderer as contract violations.

const violations = { 'Math.random in setup': 0, 'Math.random in seek': 0, requestAnimationFrame: 0, setTimeout: 0, setInterval: 0, 'Date.now': 0, 'performance.now': 0 };
let inSeek = false;
{
  let a = 0x2f6b9c1d;
  Math.random = () => {
    violations[inSeek ? 'Math.random in seek' : 'Math.random in setup']++;
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const wrap = (obj, key, label) => {
    const orig = obj[key].bind(obj);
    obj[key] = (...args) => {
      if (inSeek) violations[label]++;
      return orig(...args);
    };
  };
  wrap(window, 'requestAnimationFrame', 'requestAnimationFrame');
  wrap(window, 'setTimeout', 'setTimeout');
  wrap(window, 'setInterval', 'setInterval');
  wrap(Date, 'now', 'Date.now');
  wrap(performance, 'now', 'performance.now');
}

// Nothing may animate on its own: CSS transitions and animations run on wall
// time, so they are switched off in preview and render alike.
const freeze = document.createElement('style');
freeze.textContent = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}';
document.head.appendChild(freeze);

// ── defineFilm ──────────────────────────────────────────────────────────────

/**
 * defineFilm({
 *   duration: 12, fps: 60,
 *   formats: ['16x9', '9x16'],          // or { wide: [1920, 1080], ... }
 *   timeline: { shots: [{ name, start, end }], cues: [{ t, label }] },
 *   audio: { score: './score.mjs', track: '../assets/music.wav', trackGain: -3 },
 *   loop: true, poster: 6.2,
 *   async setup(ctx) {},                // build DOM, preload assets
 *   seek(t, ctx) {},                    // paint frame t — nothing else
 * })
 * ctx = { format, width, height, orientation, stage, render, params }
 */
export function defineFilm(spec) {
  boot(spec).catch((err) => {
    const msg = err && err.stack ? err.stack : String(err);
    window.__filmError = msg;
    console.error(msg);
    if (!RENDER) showError(msg);
  });
}

function normalizeFormats(f) {
  if (!f) return { '16x9': FORMATS['16x9'] };
  if (Array.isArray(f)) {
    const out = {};
    for (const name of f) {
      if (!FORMATS[name]) throw new Error(`Unknown format "${name}". Known: ${Object.keys(FORMATS).join(', ')} — or pass { name: [w, h] }.`);
      out[name] = FORMATS[name];
    }
    return out;
  }
  return f;
}

async function boot(spec) {
  if (!(spec.duration > 0)) throw new Error('defineFilm: duration (seconds) is required');
  if (typeof spec.seek !== 'function') throw new Error('defineFilm: seek(t, ctx) is required');
  const formats = normalizeFormats(spec.formats);
  const format = params.get('format') || Object.keys(formats)[0];
  if (!formats[format]) throw new Error(`Format "${format}" is not declared. This film has: ${Object.keys(formats).join(', ')}`);
  const [width, height] = formats[format];
  const scale = Number(params.get('scale') || 1);
  const orientation = width > height ? 'landscape' : width < height ? 'portrait' : 'square';

  const root = document.documentElement;
  root.dataset.format = format;
  root.dataset.orientation = orientation;
  root.style.setProperty('--film-w', `${width}px`);
  root.style.setProperty('--film-h', `${height}px`);

  let stage = typeof spec.stage === 'string' ? document.querySelector(spec.stage) : spec.stage || document.getElementById('stage');
  if (!stage) {
    stage = document.createElement('div');
    stage.id = 'stage';
    document.body.appendChild(stage);
  }
  Object.assign(document.body.style, { margin: '0', overflow: 'hidden', background: RENDER ? '#000' : '#141414' });
  Object.assign(stage.style, { position: 'absolute', left: '0', top: '0', width: `${width}px`, height: `${height}px`, overflow: 'hidden', transformOrigin: '0 0' });
  if (RENDER && scale !== 1) stage.style.transform = `scale(${scale})`;

  const ctx = { format, width, height, orientation, stage, render: RENDER, params };
  if (spec.setup) await spec.setup(ctx);

  // Wait for every declared font face and every image to be decoded, so the
  // first captured frame is identical to the hundredth. Anything that fails to
  // load is a missing asset: the renderer refuses to ship frames without it.
  const missing = [];
  await Promise.all([...document.fonts].map((f) => f.load().catch(() => missing.push(`font: ${f.family} ${f.weight}`))));
  await document.fonts.ready;
  await Promise.all([...document.images].map(async (img) => {
    if (!img.complete) await new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); });
    if (!img.naturalWidth) missing.push(`image: ${img.getAttribute('src')}`);
    else await img.decode().catch(() => {});
  }));

  const seek = async (t) => {
    inSeek = true;
    try {
      await spec.seek(t, ctx);
    } finally {
      inSeek = false;
    }
  };
  await seek(0);

  if (params.get('guides') === '1') drawGuides(stage, width, height, format);

  const film = {
    duration: spec.duration,
    fps: spec.fps || 60,
    format,
    formats,
    width,
    height,
    scale,
    loop: !!spec.loop,
    poster: spec.poster ?? null,
    timeline: spec.timeline || { shots: [], cues: [] },
    audio: spec.audio || null,
    violations,
    missing,
    seek,
  };
  window.__film = film;
  window.seek = seek;
  window.__ready = true;
  if (!RENDER) startPlayer(film, stage);
}

// ── guides ──────────────────────────────────────────────────────────────────
// Title-safe margins for every format, plus the zones vertical platforms cover
// with captions and buttons. Turn on with ?guides=1 or G in the player.

function drawGuides(stage, w, h, format) {
  let g = stage.querySelector(':scope > .__guides');
  if (g) { g.remove(); return; }
  g = document.createElement('div');
  g.className = '__guides';
  Object.assign(g.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '2147483647' });
  const box = (x, y, bw, bh, color, label) => {
    const d = document.createElement('div');
    Object.assign(d.style, { position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${bw}px`, height: `${bh}px`, border: `2px dashed ${color}`, boxSizing: 'border-box', font: '600 18px ui-monospace, Menlo, monospace', color, padding: '6px 8px' });
    d.textContent = label;
    g.appendChild(d);
  };
  const m = Math.round(Math.min(w, h) * 0.05);
  box(m, m, w - 2 * m, h - 2 * m, 'rgba(0,200,255,.9)', 'title-safe 5%');
  if (h > w) {
    box(0, 0, w, 220, 'rgba(255,60,60,.9)', 'platform header');
    box(0, h - 420, w, 420, 'rgba(255,60,60,.9)', 'captions + CTA (keep text out)');
    box(w - 140, h - 1000, 140, 580, 'rgba(255,60,60,.9)', 'buttons');
  }
  stage.appendChild(g);
}

// ── preview player (never present in render mode) ──────────────────────────

function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

function startPlayer(film, stage) {
  const BAR = 64;
  const ui = document.createElement('div');
  ui.innerHTML = `
    <style>
      .__bar{position:fixed;left:0;right:0;bottom:0;height:${BAR}px;display:flex;align-items:center;gap:14px;padding:0 16px;
        background:#0d0d0d;color:#e8e8e8;font:500 13px ui-monospace,Menlo,Consolas,monospace;z-index:2147483647;user-select:none}
      .__bar button{background:#222;color:#eee;border:1px solid #333;border-radius:6px;padding:6px 10px;font:inherit;cursor:pointer}
      .__bar button.on{background:#e8e8e8;color:#111}
      .__scrub{position:relative;flex:1;height:34px;background:#1b1b1b;border-radius:6px;cursor:pointer;overflow:hidden}
      .__shot{position:absolute;top:0;bottom:0;border-right:1px solid #000;color:#8a8a8a;font-size:11px;padding:3px 6px;white-space:nowrap;overflow:hidden}
      .__cue{position:absolute;bottom:0;width:1px;height:9px;background:#f5a623}
      .__head{position:absolute;top:0;bottom:0;width:2px;background:#fff;pointer-events:none}
      .__time{min-width:250px}
    </style>
    <div class="__bar">
      <button class="__play" title="space">▶</button>
      <div class="__time"></div>
      <div class="__scrub"><div class="__head"></div></div>
      <span class="__formats"></span>
      <button class="__loop on" title="L">loop</button>
      <button class="__mute" title="M">sound</button>
      <button class="__guide" title="G">guides</button>
    </div>`;
  document.body.appendChild(ui);
  const $ = (s) => ui.querySelector(s);
  const scrub = $('.__scrub'), head = $('.__head'), timeEl = $('.__time');
  const shots = film.timeline.shots || [];
  const cues = film.timeline.cues || [];
  const D = film.duration;
  const tints = ['#232323', '#1e1e1e'];
  shots.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = '__shot';
    Object.assign(d.style, { left: `${(s.start / D) * 100}%`, width: `${((s.end - s.start) / D) * 100}%`, background: tints[i % 2] });
    d.textContent = s.name;
    scrub.insertBefore(d, head);
  });
  cues.forEach((c) => {
    const d = document.createElement('div');
    d.className = '__cue';
    d.style.left = `${(c.t / D) * 100}%`;
    d.title = c.label || '';
    scrub.insertBefore(d, head);
  });
  for (const name of Object.keys(film.formats)) {
    const b = document.createElement('button');
    b.textContent = name;
    if (name === film.format) b.className = 'on';
    b.onclick = () => {
      const u = new URL(location.href);
      u.searchParams.set('format', name);
      u.hash = `t=${now.toFixed(3)}`;
      location.href = u.href;
    };
    $('.__formats').appendChild(b);
  }

  const fit = () => {
    const s = Math.min((innerWidth - 32) / film.width, (innerHeight - BAR - 32) / film.height);
    stage.style.transform = `scale(${s})`;
    stage.style.left = `${(innerWidth - film.width * s) / 2}px`;
    stage.style.top = `${(innerHeight - BAR - film.height * s) / 2}px`;
  };
  addEventListener('resize', fit);
  fit();

  let now = Number((location.hash.match(/t=([\d.]+)/) || [])[1] || 0);
  let playing = false, looping = true, muted = false;
  let startWall = 0, startT = 0;
  let audio = null, sources = [];

  const shotAt = (t) => (shots.find((s) => t >= s.start && t < s.end) || {}).name || '';
  const paint = async (t) => {
    now = Math.min(Math.max(t, 0), D);
    await film.seek(now);
    head.style.left = `${(now / D) * 100}%`;
    timeEl.textContent = `${fmtTime(now)} / ${fmtTime(D)}  f${Math.round(now * film.fps)}  ${shotAt(now)}`;
  };

  async function buildAudio() {
    const spec = film.audio;
    if (!spec) return null;
    const ac = new AudioContext({ sampleRate: 48000 });
    const out = [];
    if (spec.score) {
      // synthesize in a worker so playback never stalls while the score is made
      const worker = new Worker('/_studio/score-worker.mjs', { type: 'module' });
      const mix = await new Promise((resolve) => {
        worker.onmessage = (e) => resolve(e.data);
        worker.postMessage({ url: new URL(spec.score, location.href).href, duration: D, sampleRate: 48000 });
      });
      worker.terminate();
      if (mix.error) throw new Error(`score.mjs failed: ${mix.error}`);
      const buf = ac.createBuffer(2, mix.length, mix.sampleRate);
      buf.copyToChannel(mix.left, 0);
      buf.copyToChannel(mix.right, 1);
      out.push({ buf, gain: 10 ** ((spec.scoreGain || 0) / 20) * 0.5 });
    }
    if (spec.track) {
      const res = await fetch(new URL(spec.track, location.href).href);
      const buf = await ac.decodeAudioData(await res.arrayBuffer());
      out.push({ buf, gain: 10 ** ((spec.trackGain || 0) / 20) * 0.5, offset: spec.trackOffset || 0 });
    }
    return { ac, out };
  }
  function stopAudio() {
    sources.forEach((s) => { try { s.stop(); } catch {} });
    sources = [];
  }
  function startAudio(t) {
    stopAudio();
    if (!audio || muted) return;
    for (const { buf, gain, offset = 0 } of audio.out) {
      const src = audio.ac.createBufferSource();
      const g = audio.ac.createGain();
      g.gain.value = gain;
      src.buffer = buf;
      src.connect(g).connect(audio.ac.destination);
      src.start(0, Math.max(0, t + offset));
      sources.push(src);
    }
  }
  // The wall clock drives playback; audio is started at the matching offset.
  // (An AudioContext's clock stalls when there is no output device.)
  const clock = () => performance.now() / 1000;

  let building = null;
  async function play() {
    if (now >= D) now = 0;
    playing = true;
    $('.__play').textContent = '❚❚';
    startWall = clock();
    startT = now;
    requestAnimationFrame(tick);
    if (film.audio && !audio) {
      // the picture starts now; the sound joins at the right offset when ready
      building = building || buildAudio().catch((e) => { console.error(e); return null; });
      audio = await building;
    }
    if (audio) {
      await audio.ac.resume();
      if (playing) startAudio(startT + (clock() - startWall));
    }
  }
  function pause() {
    playing = false;
    $('.__play').textContent = '▶';
    stopAudio();
    history.replaceState(null, '', `#t=${now.toFixed(3)}`);
  }
  async function tick() {
    if (!playing) return;
    let t = startT + (clock() - startWall);
    if (t >= D) {
      if (looping) { startWall = clock(); startT = 0; t = 0; startAudio(0); }
      else { await paint(D); pause(); return; }
    }
    await paint(t);
    requestAnimationFrame(tick);
  }
  const seekTo = async (t) => {
    await paint(t);
    if (playing) { startWall = clock(); startT = now; startAudio(now); }
  };

  $('.__play').onclick = () => (playing ? pause() : play());
  $('.__loop').onclick = (e) => { looping = !looping; e.target.classList.toggle('on', looping); };
  $('.__mute').onclick = (e) => { muted = !muted; e.target.classList.toggle('on', !muted); if (playing) { startWall = clock(); startT = now; startAudio(now); } };
  $('.__mute').classList.toggle('on', !!film.audio);
  $('.__guide').onclick = (e) => { drawGuides(stage, film.width, film.height, film.format); e.target.classList.toggle('on'); };
  let dragging = false;
  const scrubTo = (e) => { const r = scrub.getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * D); };
  scrub.onpointerdown = (e) => { dragging = true; scrub.setPointerCapture(e.pointerId); scrubTo(e); };
  scrub.onpointermove = (e) => dragging && scrubTo(e);
  scrub.onpointerup = () => { dragging = false; };
  addEventListener('keydown', (e) => {
    const f = 1 / film.fps;
    if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
    else if (e.code === 'ArrowRight') seekTo(now + (e.shiftKey ? 1 : f));
    else if (e.code === 'ArrowLeft') seekTo(now - (e.shiftKey ? 1 : f));
    else if (e.code === 'Home') seekTo(0);
    else if (e.code === 'End') seekTo(D);
    else if (e.code === 'KeyL') $('.__loop').click();
    else if (e.code === 'KeyM') $('.__mute').click();
    else if (e.code === 'KeyG') $('.__guide').click();
  });
  paint(now);
}

function showError(msg) {
  const pre = document.createElement('pre');
  Object.assign(pre.style, { position: 'fixed', inset: '20px', margin: '0', padding: '20px', background: '#2a0000', color: '#ffb4b4', font: '13px/1.5 ui-monospace, Menlo, monospace', whiteSpace: 'pre-wrap', zIndex: '2147483647', borderRadius: '8px', overflow: 'auto' });
  pre.textContent = msg;
  document.body.appendChild(pre);
}
