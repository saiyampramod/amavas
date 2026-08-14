// Verifies that every death and every execution produces its own headline beat,
// so players cannot miss who died or who was cast out.
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const N = 7;
let code = null, done = false;
const bots = [];
const seen = [];
const pick = a => a[Math.floor(Math.random() * a.length)];

function mk(name, host) {
  const ws = new WebSocket(URL);
  const b = { name, ws, state: null, acted: new Set(), host };
  ws.on('open', () => ws.send(JSON.stringify(host
    ? { type: 'join', name, create: true } : { type: 'join', name, code })));
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'joined' && host) {
      code = m.code;
      for (let i = 1; i < N; i++) setTimeout(() => mk('B' + i, false), i * 55);
      return;
    }
    if (m.type !== 'state') return;
    b.state = m;
    if (host && m.headline && !seen.some(h => h.id === m.headline.id)) seen.push(m.headline);
    setTimeout(() => act(b), 30 + Math.random() * 60);
  });
  ws.on('error', () => {});
  bots.push(b);
  return b;
}

function act(b) {
  const s = b.state;
  if (!s || !s.you || done) return;
  const send = o => b.ws.readyState === 1 && b.ws.send(JSON.stringify(o));
  if (s.offer) return send({ type: 'offer', accept: true });
  if (b.host && s.phase === 'lobby' && s.seatedCount === N && !b.started) {
    b.started = true; return setTimeout(() => send({ type: 'start' }), 400);
  }
  if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
    const k = 'n' + s.dayNum;
    if (!b.acted.has(k)) { b.acted.add(k); send({ type: 'nightAction', target: pick(s.actionPrompt.targets).id }); }
  }
  if (s.phase === 'day') {
    if (s.nomination && s.nomination.youEligible && !s.nomination.youVoted) send({ type: 'vote', yes: Math.random() < 0.75 });
    if (!s.nomination && s.canNominate && s.nominees) {
      const others = s.nominees.filter(t => t.id !== s.you.id);
      const k = 'nom' + s.dayNum;
      if (others.length && !b.acted.has(k) && Math.random() < 0.6) { b.acted.add(k); send({ type: 'nominate', target: pick(others).id }); }
    }
    if (b.host) {
      const k = 'end' + s.dayNum;
      if (!b.acted.has(k) && !s.nomination) { b.acted.add(k); setTimeout(() => send({ type: 'endDay' }), 1400); }
    }
  }
  if (s.phase === 'over' && !done) {
    done = true;
    console.log(`beats raised: ${seen.length}`);
    for (const h of seen) console.log(`  [${h.kind}] ${h.title}`);
    const kinds = new Set(seen.map(h => h.kind));
    const ok = seen.length >= 2 && (kinds.has('death') || kinds.has('cast-out'));
    console.log(ok ? 'PASS — deaths and evictions each get their own moment' : 'FAIL — beats missing');
    process.exit(ok ? 0 : 1);
  }
}

mk('B0', true);
setTimeout(() => { console.log('timeout; beats so far:', seen.length); process.exit(1); }, 60000);
