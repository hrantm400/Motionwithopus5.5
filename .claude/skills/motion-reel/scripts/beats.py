#!/usr/bin/env python3
"""beats.py — measure a music track before you animate to it.

    python3 beats.py song.wav > beats.json
    python3 beats.py song.mp3 --out films/x/src/beats.json [--bpm 70:180] [--engine numpy|librosa]

Prints JSON:
    bpm        tempo estimate
    beats      every beat, seconds          → state changes go here
    downbeats  first beat of each bar, assuming 4/4 (a heuristic: check it
               against the energy curve or ask) → big moments go here
    hits       strong onsets (accents)      → clicks, whooshes, cuts go here
    energy     [[t, dB], ...] every 0.25 s  → find the build, the drop, the outro

Needs ffmpeg and numpy. Uses librosa when it is installed (pip install librosa),
otherwise a numpy implementation: spectral-flux onsets, autocorrelation tempo
and dynamic-programming beat tracking (Ellis 2007).
"""

import argparse
import json
import subprocess
import sys

import numpy as np

SR = 22050
HOP = 256
NFFT = 1024
PAD = 0.1  # seconds of silence prepended so a hit at t = 0 is still an onset


def decode(path):
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def refine(y, times, before=0.05, after=0.06):
    """Snap each time to its attack: halfway up the rise from the quietest
    2 ms frame to the loudest one nearby. Frame-based onsets can be a frame
    off; if there is no clear rise (a hit buried in a pad), keep the time."""
    n = int(0.002 * SR)
    out = []
    for t in times:
        a, b = max(0, int((t - before) * SR)), min(len(y), int((t + after) * SR))
        seg = y[a:b]
        m = len(seg) // n
        if m < 8:
            out.append(t)
            continue
        rms = np.sqrt(np.mean(seg[: m * n].reshape(m, n) ** 2, axis=1))
        peak = int(np.argmax(rms))
        low = int(np.argmin(rms[: peak + 1]))
        if rms[peak] < 2.0 * (rms[low] + 1e-9):
            out.append(t)
            continue
        level = rms[low] + 0.5 * (rms[peak] - rms[low])
        above = low + np.nonzero(rms[low: peak + 1] >= level)[0]
        out.append((a + int(above[0]) * n) / SR)
    return np.array(out)


def fit_bpm(beats_t, fallback):
    """Least-squares slope of beat time vs. beat index: sub-frame accurate."""
    if len(beats_t) < 4:
        return fallback
    k = np.arange(len(beats_t))
    slope = np.polyfit(k, beats_t, 1)[0]
    return 60.0 / slope if slope > 0 else fallback


def stft_mag(y):
    pad = np.concatenate([np.zeros(NFFT // 2, np.float32), y, np.zeros(NFFT // 2, np.float32)])
    n = 1 + (len(pad) - NFFT) // HOP
    idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
    frames = pad[idx] * np.hanning(NFFT).astype(np.float32)
    return np.abs(np.fft.rfft(frames, axis=1))


def onset_envelope(mag):
    logm = np.log1p(100.0 * mag)
    flux = np.maximum(0.0, np.diff(logm, axis=0)).sum(axis=1)
    flux = np.concatenate([[0.0], flux])
    # remove the slow trend so loud sections do not dominate
    k = 16
    trend = np.convolve(flux, np.ones(2 * k + 1) / (2 * k + 1), mode="same")
    env = np.maximum(0.0, flux - trend)
    return env / (env.max() + 1e-9)


def low_band_flux(mag):
    bins = int(150 / (SR / NFFT)) + 1
    logm = np.log1p(100.0 * mag[:, :bins])
    flux = np.maximum(0.0, np.diff(logm, axis=0)).sum(axis=1)
    return np.concatenate([[0.0], flux])


def tempo(env, fps, lo, hi):
    env = env - env.mean()
    ac = np.correlate(env, env, mode="full")[len(env) - 1:]
    lags = np.arange(len(ac))
    with np.errstate(divide="ignore"):
        bpm = 60.0 * fps / lags
    valid = (bpm >= lo) & (bpm <= hi)
    # mild preference for ~120 bpm, one octave wide (as librosa does)
    prior = np.exp(-0.5 * (np.log2(np.where(valid, bpm, 120) / 120.0)) ** 2)
    score = np.where(valid, ac * prior, -np.inf)
    lag = int(np.argmax(score))
    if 1 <= lag < len(ac) - 1:
        a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
        denom = a - 2 * b + c
        shift = 0.5 * (a - c) / denom if denom != 0 else 0.0
    else:
        shift = 0.0
    return 60.0 * fps / (lag + shift)


def track_beats(env, fps, bpm, tightness=100.0):
    period = 60.0 * fps / bpm
    n = len(env)
    score = env.copy()
    back = np.full(n, -1)
    lo, hi = int(round(period / 2)), int(round(2 * period))
    for t in range(n):
        a, b = max(0, t - hi), t - lo
        if b <= a:
            continue
        taus = np.arange(a, b)
        penalty = -tightness * np.log((t - taus) / period) ** 2
        cand = score[a:b] + penalty
        j = int(np.argmax(cand))
        if cand[j] > 0:
            score[t] = env[t] + cand[j]
            back[t] = a + j
    # start from the best-scoring frame in the last period, then walk back
    tail = max(0, n - int(round(period)))
    t = tail + int(np.argmax(score[tail:]))
    beats = []
    while t >= 0:
        beats.append(t)
        t = back[t]
    beats = np.array(beats[::-1])
    # trim weak leading/trailing beats (silence before the music starts)
    strong = env[beats] > 0.05 * env.max()
    if strong.any():
        first, last = np.argmax(strong), len(strong) - np.argmax(strong[::-1])
        beats = beats[first:last]
    return beats


def pick_hits(env, fps, k=2.5, min_gap=0.1):
    thresh = env.mean() + k * env.std()
    gap = max(1, int(min_gap * fps))
    hits, last = [], -gap
    for i in range(1, len(env) - 1):
        lo, hi = max(0, i - 3), min(len(env), i + 4)
        if env[i] >= thresh and env[i] == env[lo:hi].max() and i - last >= gap:
            hits.append(i)
            last = i
    return np.array(hits, dtype=int)


def energy_curve(y, step=0.25):
    n = int(step * SR)
    out = []
    for i in range(0, len(y) - n + 1, n):
        rms = float(np.sqrt(np.mean(y[i:i + n] ** 2)) + 1e-12)
        out.append([round(i / SR, 3), round(20 * np.log10(rms), 1)])
    return out


def downbeats_from(beats_t, low_flux, fps):
    if len(beats_t) < 8:
        return beats_t[::4]
    idx = np.clip(np.round(np.asarray(beats_t) * fps).astype(int), 0, len(low_flux) - 1)
    strength = np.array([low_flux[idx[p::4]].mean() for p in range(4)])
    phase = int(np.argmax(strength))
    # Kicks on 1 and 3 look alike; when two phases are close, music usually
    # starts on a downbeat, so prefer the phase of the first beat.
    if strength[0] >= 0.9 * strength[phase]:
        phase = 0
    return beats_t[phase::4]


def analyze_numpy(y, lo, hi):
    mag = stft_mag(y)
    fps = SR / HOP
    env = onset_envelope(mag)
    bpm = tempo(env, fps, lo, hi)
    beats_t = track_beats(env, fps, bpm) / fps
    hits_t = pick_hits(env, fps) / fps
    down_t = downbeats_from(beats_t, low_band_flux(mag), fps)
    return bpm, beats_t, down_t, hits_t


def analyze_librosa(y, lo, hi):
    import librosa

    fps = SR / HOP
    env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=HOP)
    bpm, beats = librosa.beat.beat_track(onset_envelope=env, sr=SR, hop_length=HOP, start_bpm=120)
    bpm = float(np.atleast_1d(bpm)[0])
    beats_t = librosa.frames_to_time(beats, sr=SR, hop_length=HOP)
    if not (lo <= bpm <= hi) and len(beats_t) > 4:
        bpm = 60.0 / np.median(np.diff(beats_t))
    norm = env / (env.max() + 1e-9)
    hits_t = pick_hits(norm, fps) / fps
    mag = stft_mag(y)
    down_t = downbeats_from(beats_t, low_band_flux(mag), fps)
    return bpm, beats_t, down_t, hits_t


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audio")
    ap.add_argument("--bpm", default="60:160", help="allowed tempo range (default 60:160; fast tracks read half-time, pass 100:200 to force)")
    ap.add_argument("--engine", choices=["auto", "numpy", "librosa"], default="auto")
    ap.add_argument("--out", help="write JSON here instead of stdout")
    a = ap.parse_args()
    lo, hi = (float(v) for v in a.bpm.split(":"))

    y = decode(a.audio)
    if len(y) < SR:
        sys.exit("beats.py: audio is shorter than one second")
    duration = len(y) / SR
    y = np.concatenate([np.zeros(int(PAD * SR), np.float32), y])

    engine = a.engine
    if engine == "auto":
        try:
            import librosa  # noqa: F401
            engine = "librosa"
        except ImportError:
            engine = "numpy"
    bpm, beats_t, down_t, hits_t = (analyze_librosa if engine == "librosa" else analyze_numpy)(y, lo, hi)
    beats_t = refine(y, beats_t)
    hits_t = refine(y, hits_t)
    down_t = refine(y, down_t)
    bpm = fit_bpm(beats_t, bpm)
    unpad = lambda xs: [x - PAD for x in xs if x - PAD >= -0.01]  # noqa: E731
    beats_t, down_t, hits_t = unpad(beats_t), unpad(down_t), unpad(hits_t)

    r = lambda xs: [round(max(0.0, float(x)), 3) for x in xs]  # noqa: E731
    result = {
        "source": a.audio,
        "engine": engine,
        "duration": round(duration, 3),
        "bpm": round(float(bpm), 2),
        "beats": r(beats_t),
        "downbeats": r(down_t),
        "hits": r(hits_t),
        "energy": energy_curve(y[int(PAD * SR):]),
    }
    text = json.dumps(result, indent=1)
    if a.out:
        with open(a.out, "w") as f:
            f.write(text + "\n")
        print(f"beats.py: {result['bpm']} bpm, {len(result['beats'])} beats, {len(result['downbeats'])} downbeats, {len(result['hits'])} hits -> {a.out}", file=sys.stderr)
    else:
        print(text)


if __name__ == "__main__":
    main()
