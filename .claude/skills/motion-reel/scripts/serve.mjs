#!/usr/bin/env node
// serve.mjs — preview films in a browser with a scrubber, sound and guides.
//
//   node serve.mjs [--port 5173] [--host 127.0.0.1]
//
// Space play/pause · ←/→ one frame · Shift+←/→ one second · L loop · M sound · G guides

import { parseArgs, startServer, listFilms } from './lib/studio.mjs';

const args = parseArgs();
const host = args.host || '127.0.0.1';
let srv;
try {
  srv = await startServer({ port: Number(args.port || 5173), host });
} catch {
  srv = await startServer({ port: 0, host });
}
console.log(`motion studio → ${srv.origin}/`);
for (const f of listFilms()) console.log(`  ${srv.origin}/films/${f}/src/`);
console.log('Space play · ←/→ frame · Shift+←/→ second · L loop · M sound · G guides · Ctrl+C to stop');
