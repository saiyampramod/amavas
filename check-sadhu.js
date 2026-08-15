// Can the Sadhu kill the demon by blessing it two nights running?
// Uses Storyteller mode so the harness can see the grimoire, find the Sadhu and the
// demon, and deliberately blessing the demon twice. Asserts GOOD wins on the spot.
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const SIZE = 12;               // 12 seats => 7 of monsoon's 8 resident roles are dealt
const MAX_ATTEMPTS = 8;

let attempt = 0;

function runAttempt() {
  return new Promise(resolve => {
    let code = null, settled = false, grim = null, sadhuId = null, demonId = null;
    const bots = [];
    const byName = {};
    const finish = r => { if (settled) return; settled = true; bots.forEach(b => { try { b.ws.close(); } catch {} }); setTimeout(() => resolve(r), 150); };
    const timer = setTimeout(() => finish({ status: 'timeout' }), 30000);

    function mk(name, isST) {
      const ws = new WebSocket(URL);
      const b = { name, ws, isST, state: null, acted: new Set() };
      byName[name] = b;
      ws.on('open', () => ws.send(JSON.stringify(isST
        ? { type: 'join', name, create: true } : { type: 'join', name, code })));
      ws.on('message', raw => {
        const m = JSON.parse(raw);
        if (m.type === 'joined' && isST) {
          code = m.code;
          for (let i = 0; i < SIZE; i++) setTimeout(() => bots.push(mk('P' + i, false)), i * 30);
          return;
        }
        if (m.type !== 'state') return;
        b.state = m;
        if (isST && m.grimoire) grim = m.grimoire;
        setTimeout(() => act(b), 15 + Math.random() * 30);
      });
      ws.on('error', () => {});
      return b;
    }

    function act(b) {
      const s = b.state;
      if (!s || !s.you || settled) return;
      const send = o => b.ws.readyState === 1 && b.ws.send(JSON.stringify(o));
      if (s.offer) return send({ type: 'offer', accept: false });

      if (b.isST) {
        if (s.decision) return send({ type: 'decision', option: '__auto' });
        if (s.phase === 'lobby') {
          if (!b.stSet) { b.stSet = true; return send({ type: 'setStoryteller', on: true }); }
          if (!b.scriptSet) { b.scriptSet = true; return send({ type: 'setScript', id: 'monsoon' }); }
          if (!b.started && s.seatedCount === SIZE && s.storyteller && s.scriptId === 'monsoon') {
            b.started = true; return setTimeout(() => send({ type: 'start' }), 200);
          }
          return;
        }
        // learn who the Sadhu and the demon are, once roles are dealt
        if (grim && !sadhuId) {
          const sadhu = grim.find(g => g.role === 'Sadhu');
          const demon = grim.find(g => g.kind === 'demon');
          if (!sadhu) { clearTimeout(timer); return finish({ status: 'no-sadhu' }); }
          sadhuId = sadhu.id; demonId = demon.id;
        }
        // push straight to the next night: no accusations, no executions
        if (s.phase === 'day') {
          const k = 'end' + s.dayNum;
          if (!b.acted.has(k) && !s.nomination) { b.acted.add(k); setTimeout(() => send({ type: 'endDay' }), 300); }
        }
        if (s.phase === 'over') {
          clearTimeout(timer);
          return finish({ status: 'over', winner: s.winner, reason: s.winReason, day: s.dayNum });
        }
        return;
      }

      if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
        const k = 'n' + s.dayNum;
        if (b.acted.has(k)) return;
        b.acted.add(k);
        const targets = s.actionPrompt.targets;
        // the Sadhu blesses the demon EVERY night — the second one should curdle
        let t = null;
        if (s.you.id === sadhuId) t = targets.find(x => x.id === demonId);
        if (!t) t = targets[Math.floor(Math.random() * targets.length)];
        send({ type: 'nightAction', target: t.id });
      }
    }
    bots.push(mk('Teller', true));
  });
}

(async () => {
  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    const r = await runAttempt();
    if (r.status === 'no-sadhu') { continue; }          // Sadhu wasn't dealt, reshuffle
    if (r.status === 'timeout') { console.log(`attempt ${attempt}: timed out`); continue; }
    console.log(`attempt ${attempt}: game ended on day ${r.day}`);
    console.log(`  winner: ${r.winner}`);
    console.log(`  reason: ${r.reason}`);
    const killedDemon = r.winner === 'good' && /is dead/.test(r.reason);
    console.log(killedDemon
      ? 'PASS — blessing the demon twice killed it and ended the game for good'
      : 'INCONCLUSIVE — the demon died another way or evil won first');
    process.exit(killedDemon ? 0 : 1);
  }
  console.log('could not get a Sadhu dealt in', MAX_ATTEMPTS, 'attempts');
  process.exit(1);
})();
