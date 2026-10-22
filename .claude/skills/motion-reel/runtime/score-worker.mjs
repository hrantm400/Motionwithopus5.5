// score-worker.mjs — renders a film's score off the main thread for the
// preview player, so the picture can start playing while the sound is made.
self.onmessage = async ({ data: { url, duration, sampleRate } }) => {
  try {
    const mod = await import(url);
    const mix = await mod.default({ duration, sampleRate });
    self.postMessage({ left: mix.left, right: mix.right, sampleRate: mix.sampleRate, length: mix.length }, [mix.left.buffer, mix.right.buffer]);
  } catch (err) {
    self.postMessage({ error: String((err && err.stack) || err) });
  }
};
