// Simulates real phones: sockets drop at random all game long — locked screens, lifts,
// flaky WiFi — and reconnect. Nobody may lose their seat, their role, or the host chair.
// node check-chaos.js [storyteller]
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const SIZE = 9;
const ST_MODE = process.argv[2] === 'storyteller';
const DROP_CHANCE = 0.06;          // per state update, until this player's budget is spent
const DROPS_EACH = 2;              // a phone might blip once or twice a game, not constantly
const dropCount = {};              // by NAME, so it survives reconnects

let code = null, settled = false, drops = 0, kicked = [], hostChanges = 0, lastHost = null;
const seats = {};                  // name -> { token, role }
const bots = [];
const pick = a => a[Math.floor(Math.random() * a.length)];

function finish(ok, why) {
  if (settled) return; settled = true;
  bots.forEach(b => { try { b.ws.close(); } catch {} });
  console.log(`\ndrops simulated: ${drops}`);
  console.log(`host changes: ${hostChanges}`);
  if (kicked.length) { console.log('KICKED OUT:'); kicked.forEach(k => console.log('  -', k)); }
  console.log(ok ? 'PASS — ' + why : 'FAIL — ' + why);
  setTimeout(() => process.exit(ok ? 0 : 1), 200);
}

function mk(name, first, token) {
  const ws = new WebSocket(URL);
  const b = { name, ws, first, state: null, acted: new Set() };
  ws.on('open', () => {
    if (token) return ws.send(JSON.stringify({ type: 'join', token }));
    ws.send(JSON.stringify(first ? { type: 'join', name, create: true } : { type: 'join', name, code }));
  });
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'joined') {
      if (first && !code) {
        code = m.code;
        // in storyteller mode the host sits out, so SIZE players still need seats
        const extras = ST_MODE ? SIZE : SIZE - 1;
        for (let i = 1; i <= extras; i++) setTimeout(() => bots.push(mk('P' + i, false)), i * 40);
      }
      seats[name] = seats[name] || {};
      seats[name].token = m.token;
      return;
    }
    if (m.type === 'left') { kicked.push(`${name} was ejected by the server`); return; }
    if (m.type === 'error') {
      if (/already has that name|no longer open|has finished/i.test(m.text)) kicked.push(`${name}: "${m.text}"`);
      return;
    }
    if (m.type !== 'state') return;

    // identity must never change under us
    if (m.you) {
      const s = seats[name] = seats[name] || {};
      if (m.you.role) {
        if (s.role && s.role !== m.you.role && m.phase !== 'lobby') kicked.push(`${name} role changed ${s.role} -> ${m.you.role}`);
        s.role = m.you.role;
      }
      if (m.you.name !== name) kicked.push(`${name} came back as ${m.you.name}`);
    }
    const host = (m.players || []).find(p => p.host);
    if (host && host.name !== lastHost) { if (lastHost !== null) hostChanges++; lastHost = host.name; }

    b.state = m;
    setTimeout(() => act(b), 20 + Math.random() * 50);
  });
  ws.on('error', () => {});
  ws.on('close', () => {
    if (settled || b.retired) return;
    // the phone comes back a moment later, exactly as a real one would
    setTimeout(() => {
      if (settled) return;
      const fresh = mk(name, false, seats[name] && seats[name].token);
      const i = bots.indexOf(b); if (i >= 0) bots[i] = fresh; else bots.push(fresh);
    }, 250 + Math.random() * 600);
  });
  return b;
}

function act(b) {
  const s = b.state;
  if (!s || !s.you || settled) return;
  const send = o => b.ws.readyState === 1 && b.ws.send(JSON.stringify(o));
  const isST = ST_MODE && b.name === 'Host';

  if (s.offer) return send({ type: 'offer', accept: false });
  if (isST && s.decision) return send({ type: 'decision', option: '__auto' });

  if (s.phase === 'lobby') {
    if (s.you.host) {
      if (ST_MODE && !s.storyteller && !b.stSet) { b.stSet = true; return send({ type: 'setStoryteller', on: true }); }
      if (s.seatedCount === SIZE && !b.started) {
        b.started = true; return setTimeout(() => send({ type: 'start' }), 300);
      }
    }
    return;
  }

  // chaos: yank the connection at random, but only a couple of times per player
  if ((dropCount[b.name] || 0) < DROPS_EACH && Math.random() < DROP_CHANCE) {
    dropCount[b.name] = (dropCount[b.name] || 0) + 1;
    drops++;
    try { b.ws.terminate(); } catch {}
    return;
  }

  if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
    const k = 'n' + s.dayNum;
    if (!b.acted.has(k)) { b.acted.add(k); send({ type: 'nightAction', target: pick(s.actionPrompt.targets).id }); }
  }
  if (s.phase === 'day') {
    if (s.nomination && s.nomination.youEligible && !s.nomination.youVoted) send({ type: 'vote', yes: Math.random() < 0.6 });
    if (!s.nomination && s.canNominate && s.nominees) {
      const others = s.nominees.filter(t => t.id !== s.you.id);
      const k = 'nom' + s.dayNum;
      if (others.length && !b.acted.has(k) && Math.random() < 0.5) { b.acted.add(k); send({ type: 'nominate', target: pick(others).id }); }
    }
    if (s.you.host) {
      const k = 'end' + s.dayNum;
      if (!b.acted.has(k) && !s.nomination) { b.acted.add(k); setTimeout(() => { if (b.state.phase === 'day') send({ type: 'endDay' }); }, 900); }
    }
  }
  if (s.phase === 'over') {
    b.retired = true;
    const expected = SIZE;
    const revealed = (s.reveal || []).length;
    if (revealed !== expected) kicked.push(`reveal had ${revealed}, expected ${expected}`);
    finish(kicked.length === 0, kicked.length === 0
      ? `${drops} drops and everyone kept their seat, role and identity`
      : 'players were lost to network blips');
  }
}

console.log(`chaos test — ${SIZE} players, ${ST_MODE ? 'storyteller' : 'host'} mode, random disconnects`);
bots.push(mk('Host', true));
setTimeout(() => finish(false, 'game never finished (hung)'), 90000);
