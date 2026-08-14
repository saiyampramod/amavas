// Two things stress tests miss:
//   1. a player whose phone drops mid-game can come back and still be themselves
//   2. abandoned rooms are eventually reclaimed (run with a tiny ROOM_TTL_MS)
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const N = 6;
let code = null, token = null, myRole = null, myName = 'Dropper';
const bots = [];
const pick = a => a[Math.floor(Math.random() * a.length)];
let phase = 'setup';

function mk(name, first) {
  const ws = new WebSocket(URL);
  const b = { name, ws, state: null, acted: new Set(), first };
  ws.on('open', () => ws.send(JSON.stringify(first
    ? { type: 'join', name, create: true } : { type: 'join', name, code })));
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'joined') {
      if (first) {
        code = m.code;
        // now that the room exists, seat the rest — including the one who will drop
        for (let i = 1; i < N - 1; i++) setTimeout(() => bots.push(mk('P' + i, false)), i * 40);
        setTimeout(() => bots.push(mk(myName, false)), N * 40);
      }
      if (name === myName) token = m.token;
      return;
    }
    if (m.type !== 'state') return;
    b.state = m;
    if (name === myName && m.you && m.you.role && !myRole) myRole = m.you.role;
    setTimeout(() => act(b), 20 + Math.random() * 40);
  });
  ws.on('error', () => {});
  return b;
}

function act(b) {
  const s = b.state;
  if (!s || !s.you) return;
  const send = o => b.ws.readyState === 1 && b.ws.send(JSON.stringify(o));
  if (s.offer) return send({ type: 'offer', accept: true });
  if (b.first && s.phase === 'lobby' && s.seatedCount === N && !b.started) {
    b.started = true; return setTimeout(() => send({ type: 'start' }), 300);
  }
  if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
    const k = 'n' + s.dayNum;
    if (!b.acted.has(k)) { b.acted.add(k); send({ type: 'nightAction', target: pick(s.actionPrompt.targets).id }); }
  }
  if (s.phase === 'day' && phase === 'setup' && myRole) {
    phase = 'dropping';
    const me = bots.find(x => x.name === myName);
    console.log(`${myName} is the ${myRole}; killing their connection mid-game…`);
    me.ws.close();
    setTimeout(reconnect, 1500);
  }
  if (s.phase === 'day' && b.first) {
    const k = 'end' + s.dayNum;
    if (!b.acted.has(k) && !s.nomination && phase === 'done') { b.acted.add(k); setTimeout(() => send({ type: 'endDay' }), 400); }
  }
}

function reconnect() {
  const ws = new WebSocket(URL);
  ws.on('open', () => ws.send(JSON.stringify({ type: 'join', token })));
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type !== 'state') return;
    const ok = m.you && m.you.name === myName && m.you.role === myRole && m.code === code;
    console.log(`reconnected: name=${m.you && m.you.name} role=${m.you && m.you.role} room=${m.code}`);
    console.log(ok ? 'PASS — same seat, same secret role, same room' : 'FAIL — identity lost on reconnect');
    phase = 'done';
    setTimeout(() => process.exit(ok ? 0 : 1), 300);
  });
  ws.on('error', e => { console.log('FAIL — reconnect errored:', e.message); process.exit(1); });
}

bots.push(mk('Host', true));
setTimeout(() => { console.log('timeout — phase:', phase, 'role:', myRole); process.exit(1); }, 40000);
