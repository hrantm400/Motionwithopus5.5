#!/usr/bin/env node
// capture.mjs — collect a product's real public assets for GATE 1.
//
//   node capture.mjs <url> <film> [--pages /,/pricing] [--max-images 24]
//
// Writes films/<film>/assets/site/:
//   <page>-desktop.png   1440×900 viewport          <page>-mobile.png  390×844 @2x
//   <page>-full.png      full page (capped at 6000 px tall)
//   <page>-scroll-NN.png the page section by section (works when the page
//                        scrolls inside a container and full-page shots can't)
//   images/              large <img> assets from the page (product shots, ≥ 600 px wide)
//   video/               <video> files the page plays (product footage), ≤ 80 MB each
//   logo/                favicon, apple-touch-icon, og:image, logo <img>/<svg> candidates
//   brand.json           colors weighted by on-screen area, fonts in use, page meta,
//                        the page's own copy (headings, buttons) to quote in the brief
//   README.md            what was captured, from where — and what was NOT
//
// A cookie banner is dismissed first ("reject" preferred) so it doesn't cover
// the screenshots.
//
// It only records what the site really shows. Logged-in product screens are
// never on a marketing page: ask the user for them instead of drawing fakes.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolveFilm, loadChromium, die, ROOT } from './lib/studio.mjs';

const args = parseArgs();
const [rawUrl, filmArg] = args._;
if (!rawUrl || !filmArg) die('Usage: node capture.mjs <url> <film> [--pages /,/pricing]');
const base = new URL(/^https?:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
const film = resolveFilm(filmArg);
const out = path.join(film.dir, 'assets', 'site');
for (const d of ['', 'images', 'logo', 'video']) fs.mkdirSync(path.join(out, d), { recursive: true });
const rel = (p) => path.relative(ROOT, p);
const pages = String(args.pages || base.pathname || '/').split(',').map((p) => p.trim() || '/');
const maxImages = Number(args['max-images'] || 24);
const maxSteps = Number(args['scroll-steps'] || 14);

// Close a consent banner: the most privacy-preserving button that is visible.
async function dismissConsent(page) {
  for (const pattern of [/^(reject|decline|deny)( all)?$|only (necessary|essential)|necessary only|essential only/i, /^(accept|allow)( all)?$|^(agree|got it|ok|okay)$/i]) {
    const buttons = page.locator('button, [role="button"], a');
    const n = Math.min(await buttons.count(), 200);
    for (let i = 0; i < n; i++) {
      const b = buttons.nth(i);
      const text = ((await b.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ');
      if (text.length < 40 && pattern.test(text) && (await b.isVisible().catch(() => false))) {
        await b.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(600);
        return text;
      }
    }
  }
  return null;
}

// Scroll the page (or the element that really scrolls) one screen at a time,
// letting lazy content load, with a screenshot per step.
async function scrollPass(page, name, url) {
  const files = [];
  for (let step = 0; step < maxSteps; step++) {
    const moved = await page.evaluate((k) => {
      const candidates = [document.scrollingElement, ...document.querySelectorAll('body *')].filter((el) => {
        if (!el) return false;
        const cs = el === document.scrollingElement ? null : getComputedStyle(el);
        return el.scrollHeight - el.clientHeight > 200 && (!cs || /(auto|scroll)/.test(cs.overflowY));
      });
      const el = candidates.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (!el) return false;
      if (k === 0) { el.scrollTop = 0; return true; }
      const before = el.scrollTop;
      el.scrollTop = before + Math.round(innerHeight * 0.85);
      return el.scrollTop > before;
    }, step);
    if (!moved) break;
    await page.waitForTimeout(700);
    const file = path.join(out, `${name}-scroll-${String(step + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    saved.push({ file: rel(file), from: `${url} (scrolled)` });
    files.push(file);
  }
  return files;
}

const chromium = await loadChromium();
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
const saved = [];
const brand = { url: base.href, captured: new Date().toISOString(), pages: [] };

function safeName(s) {
  return s.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home';
}

async function download(ctx, src, dir, name) {
  try {
    const res = await ctx.request.get(src, { timeout: 20000 });
    if (!res.ok()) return null;
    const type = res.headers()['content-type'] || '';
    const ext = type.includes('svg') ? '.svg' : type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : type.includes('gif') ? '.gif' : type.includes('icon') ? '.ico' : type.includes('avif') ? '.avif' : type.includes('mp4') ? '.mp4' : type.includes('webm') ? '.webm' : type.includes('quicktime') ? '.mov' : '.jpg';
    const file = path.join(dir, name + ext);
    fs.writeFileSync(file, await res.body());
    saved.push({ file: rel(file), from: src });
    return file;
  } catch {
    return null;
  }
}

try {
  for (const p of pages) {
    const url = new URL(p, base).href;
    const name = safeName(new URL(url).pathname);
    const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await desk.newPage();
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => die(`Could not open ${url}: ${e.message.split('\n')[0]}`));
    if (resp && resp.status() >= 400) console.log(`! ${url} answered HTTP ${resp.status()}`);
    await page.waitForTimeout(1200); // let hero animations settle before the screenshot
    const consent = await dismissConsent(page);
    if (consent) console.log(`  closed a consent banner ("${consent}")`);
    const shot = async (pg, file, opts = {}) => { await pg.screenshot({ path: file, ...opts }); saved.push({ file: rel(file), from: url }); };
    await shot(page, path.join(out, `${name}-desktop.png`));
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await shot(page, path.join(out, `${name}-full.png`), { fullPage: height <= 6000, clip: height > 6000 ? { x: 0, y: 0, width: 1440, height: 6000 } : undefined });

    const facts = await page.evaluate(() => {
      const hex = (c) => {
        const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c);
        if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null;
        return '#' + [m[1], m[2], m[3]].map((v) => Math.round(Number(v)).toString(16).padStart(2, '0')).join('');
      };
      const weights = new Map();
      const add = (c, w, kind) => {
        const h = hex(c);
        if (!h || w <= 0) return;
        const e = weights.get(h) || { hex: h, area: 0, text: 0 };
        e[kind] += w;
        weights.set(h, e);
      };
      const vh = innerHeight * 3;
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.top > vh) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
        add(cs.backgroundColor, r.width * Math.min(r.height, vh), 'area');
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
        if (own) add(cs.color, own.length * parseFloat(cs.fontSize), 'text');
      }
      add(getComputedStyle(document.body).backgroundColor, innerWidth * vh * 0.5, 'area');
      const fontOf = (sel) => { const el = document.querySelector(sel); return el ? { family: getComputedStyle(el).fontFamily, weight: getComputedStyle(el).fontWeight, size: getComputedStyle(el).fontSize } : null; };
      const meta = (n) => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content || null;
      const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
      const icons = [...document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"],link[rel="mask-icon"]')].map((l) => abs(l.href)).filter(Boolean);
      const logoImgs = [...document.querySelectorAll('img')].filter((i) => /logo|brand|wordmark/i.test(`${i.src} ${i.alt} ${i.className} ${i.id}`)).map((i) => abs(i.currentSrc || i.src)).filter(Boolean);
      const logoSvgs = [...document.querySelectorAll('header svg, nav svg, a[href="/"] svg, [class*="logo" i] svg, svg[class*="logo" i]')].slice(0, 6).map((s) => {
        const c = s.cloneNode(true);
        c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return c.outerHTML;
      });
      const images = [...document.images].filter((i) => i.naturalWidth >= 600).sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight).map((i) => ({ src: abs(i.currentSrc || i.src), w: i.naturalWidth, h: i.naturalHeight, alt: i.alt }));
      return {
        title: document.title,
        description: meta('description') || meta('og:description'),
        ogImage: abs(meta('og:image') || '') || null,
        themeColor: meta('theme-color'),
        colors: [...weights.values()],
        fonts: { h1: fontOf('h1'), h2: fontOf('h2'), body: fontOf('p') || fontOf('body'), button: fontOf('button, a[class*="button" i], [role="button"]'), nav: fontOf('nav a') },
        fontFaces: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/"/g, '')} ${f.weight} ${f.style}`),
        icons, logoImgs, logoSvgs, images,
      };
    });

    const sections = await scrollPass(page, name, url);
    const late = await page.evaluate(() => {
      const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
      const images = [...document.images].filter((i) => i.naturalWidth >= 600).map((i) => ({ src: abs(i.currentSrc || i.src), w: i.naturalWidth, h: i.naturalHeight, alt: i.alt }));
      const videos = [...document.querySelectorAll('video')].map((v) => ({ src: abs(v.currentSrc || v.src || v.querySelector('source')?.src || ''), poster: abs(v.poster || ''), w: v.videoWidth, h: v.videoHeight })).filter((v) => v.src && !v.src.startsWith('blob:'));
      const text = (sel) => [...new Set([...document.querySelectorAll(sel)].map((e) => e.innerText.trim().replace(/\s+/g, ' ')).filter((t) => t && t.length < 220))];
      return { images, videos, headings: text('h1, h2, h3').slice(0, 60), buttons: text('button, a[class*="button" i], [role="button"]').filter((t) => t.length < 40).slice(0, 40) };
    });
    for (const img of late.images) if (!facts.images.some((i) => i.src === img.src)) facts.images.push(img);
    facts.videos = late.videos;
    facts.copy = { headings: late.headings, buttons: late.buttons };
    let v = 0;
    for (const vid of late.videos.slice(0, 3)) {
      try {
        const head = await desk.request.head(vid.src, { timeout: 15000 });
        const size = Number(head.headers()['content-length'] || 0);
        if (size > 80 * 1048576) { console.log(`  skipped video ${vid.src} (${(size / 1048576).toFixed(0)} MB)`); continue; }
      } catch {}
      await download(desk, vid.src, path.join(out, 'video'), `${name}-${String(++v).padStart(2, '0')}`);
    }

    const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mpage = await mob.newPage();
    await mpage.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await mpage.waitForTimeout(1200);
    await dismissConsent(mpage);
    await shot(mpage, path.join(out, `${name}-mobile.png`));
    await mob.close();

    let n = 0;
    for (const img of facts.images.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, maxImages)) {
      if (img.src && !img.src.startsWith('data:')) await download(desk, img.src, path.join(out, 'images'), `${name}-${String(++n).padStart(2, '0')}-${img.w}x${img.h}`);
    }
    let k = 0;
    for (const src of [...new Set([...facts.icons, ...facts.logoImgs, facts.ogImage].filter(Boolean))]) await download(desk, src, path.join(out, 'logo'), `${name}-${String(++k).padStart(2, '0')}`);
    facts.logoSvgs.forEach((svg, i) => {
      const file = path.join(out, 'logo', `${name}-inline-${i + 1}.svg`);
      fs.writeFileSync(file, svg);
      saved.push({ file: rel(file), from: `${url} (inline svg)` });
    });

    // merge near-identical colors, keep the ones that cover the most screen or text
    const merged = [];
    const dist = (a, b) => Math.hypot(...[1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)));
    for (const c of facts.colors.sort((a, b) => b.area + b.text * 400 - (a.area + a.text * 400))) {
      const near = merged.find((m) => dist(m.hex, c.hex) < 14);
      if (near) { near.area += c.area; near.text += c.text; } else merged.push({ ...c });
    }
    const totalArea = merged.reduce((s, c) => s + c.area, 0) || 1;
    const totalText = merged.reduce((s, c) => s + c.text, 0) || 1;
    const sat = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
    const colors = merged.slice(0, 10).map((c) => ({ hex: c.hex, screen: Number((c.area / totalArea).toFixed(3)), text: Number((c.text / totalText).toFixed(3)), saturation: Number(sat(c.hex).toFixed(2)) }));
    brand.pages.push({ url, title: facts.title, description: facts.description, themeColor: facts.themeColor, colors, fonts: facts.fonts, fontFaces: [...new Set(facts.fontFaces)], images: facts.images.length, videos: facts.videos, copy: facts.copy, sections: sections.map(rel) });
    await desk.close();
    console.log(`✔ ${url} → ${colors.length} colors, ${facts.images.length} large images, ${facts.videos.length} videos, ${sections.length} section shots, ${facts.icons.length + facts.logoImgs.length + facts.logoSvgs.length} logo candidates`);
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(out, 'brand.json'), JSON.stringify(brand, null, 2));
const first = brand.pages[0] || {};
fs.writeFileSync(path.join(out, 'README.md'), [
  `# Captured from ${base.href}`,
  '',
  `On ${brand.captured.slice(0, 10)}. Everything here is what the public site shows — review it before GATE 1.`,
  '',
  '## Colors (by share of screen / share of text — guesses, confirm against the brand guide)',
  ...(first.colors || []).map((c) => `- \`${c.hex}\` screen ${(c.screen * 100).toFixed(1)}% · text ${(c.text * 100).toFixed(1)}% · saturation ${c.saturation}`),
  '',
  '## The page\'s own words (quote these; don\'t invent claims)',
  ...((first.copy && first.copy.headings) || []).map((h) => `- ${h}`),
  '',
  'Buttons: ' + (((first.copy && first.copy.buttons) || []).join(' · ') || '—'),
  '',
  '## Fonts in use',
  ...Object.entries(first.fonts || {}).filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v.family} · ${v.weight} · ${v.size}`),
  '',
  'Use the brand\'s licensed font files (ask for them). Do not scrape webfonts from the site.',
  '',
  '## Files',
  ...saved.map((s) => `- \`${s.file}\` ← ${s.from}`),
  '',
  '## Not captured',
  '- Logged-in product UI. Ask the user for real screenshots or a screen recording; never redraw an interface from imagination.',
  '- Brand guidelines, licensed fonts, music. Ask.',
  '',
].join('\n'));
console.log(`  ${rel(path.join(out, 'README.md'))} · ${saved.length} files`);
