// Opens a room, seats two players, then abandons it — used with a short ROOM_TTL_MS
// to prove abandoned rooms are reclaimed instead of leaking forever.
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const socks = [];
const a = new WebSocket(URL);
socks.push(a);
a.on('open', () => a.send(JSON.stringify({ type: 'join', name: 'A', create: true })));
a.on('message', raw => {
  const m = JSON.parse(raw);
  if (m.type !== 'joined') return;
  const code = m.code;
  const b = new WebSocket(URL);
  socks.push(b);
  b.on('open', () => b.send(JSON.stringify({ type: 'join', name: 'B', code })));
  setTimeout(() => {
    console.log('abandoning room', code);
    socks.forEach(s => { try { s.close(); } catch {} });
    process.exit(0);
  }, 1200);
});
a.on('error', e => { console.log('error:', e.message); process.exit(1); });
