// Verifies that on night 1 EVERY living player gets a prompt, so no one can tell
// from a glance at your phone whether you actually have a power.
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const N = 7;
let code = null, reported = false;
const bots = [];

function mk(name, host) {
  const ws = new WebSocket(URL);
  const b = { name, ws, state: null };
  ws.on('open', () => ws.send(JSON.stringify(host
    ? { type: 'join', name, create: true } : { type: 'join', name, code })));
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'joined' && host) {
      code = m.code;
      for (let i = 1; i < N; i++) setTimeout(() => bots.push(mk('B' + i, false)), i * 60);
      return;
    }
    if (m.type !== 'state') return;
    b.state = m;
    if (host && m.phase === 'lobby' && m.seatedCount === N && !b.started) {
      b.started = true; setTimeout(() => ws.send(JSON.stringify({ type: 'start' })), 500);
    }
    if (m.phase === 'night' && !reported) {
      reported = true;
      setTimeout(() => {
        const live = bots.filter(x => x.state);
        const prompted = live.filter(x => x.state.actionPrompt);
        const verbs = [...new Set(prompted.map(x => x.state.actionPrompt.verb))];
        console.log(`night 1: ${prompted.length} of ${live.length} players got a prompt`);
        console.log('verbs on show:', verbs.join(', '));
        console.log(prompted.length === live.length ? 'PASS — every screen looks alike' : 'FAIL — powers are visible');
        process.exit(prompted.length === live.length ? 0 : 1);
      }, 1200);
    }
  });
  ws.on('error', () => {});
  return b;
}
bots.push(mk('B0', true));
setTimeout(() => { console.log('timeout'); process.exit(1); }, 25000);
