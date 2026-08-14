// Plays many games back to back across every story mode and player count,
// including "play again", and reports anything that hangs, crashes or ends wrong.
// node stress.js [rounds]
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const ROUNDS = parseInt(process.argv[2] || '1', 10);
const SCRIPTS = ['amavas', 'monsoon', 'maya', 'agm'];
const SIZES = [5, 6, 7, 9, 12, 20];
const pick = a => a[Math.floor(Math.random() * a.length)];
const fails = [];
let ran = 0;

function playOne({ size, script, storyteller, replay }) {
  return new Promise(resolve => {
    const label = `${script}/${size}p${storyteller ? '+ST' : ''}${replay ? '+replay' : ''}`;
    let code = null, finished = 0, settled = false;
    const bots = [];
    const done = (ok, why) => {
      if (settled) return; settled = true;
      if (!ok) fails.push(`${label}: ${why}`);
      bots.forEach(b => { try { b.ws.close(); } catch {} });
      setTimeout(resolve, 120);
    };
    const timer = setTimeout(() => {
      const s = bots.find(b => b.state) || {};
      done(false, `HUNG in phase=${s.state && s.state.phase} day=${s.state && s.state.dayNum}`);
    }, 45000);

    function mk(name, first) {
      const ws = new WebSocket(URL);
      const b = { name, ws, state: null, acted: new Set(), first, isST: first && storyteller };
      ws.on('open', () => ws.send(JSON.stringify(first
        ? { type: 'join', name, create: true } : { type: 'join', name, code })));
      ws.on('message', raw => {
        let m; try { m = JSON.parse(raw); } catch { return done(false, 'bad JSON'); }
        if (m.type === 'joined' && first) {
          code = m.code;
          const need = storyteller ? size : size - 1;
          for (let i = 0; i < need; i++) setTimeout(() => bots.push(mk('P' + i, false)), i * 30);
          return;
        }
        if (m.type === 'error') return;
        if (m.type !== 'state') return;
        b.state = m;
        setTimeout(() => act(b), 8 + Math.random() * 25);
      });
      ws.on('error', e => done(false, 'socket: ' + e.message));
      return b;
    }

    function act(b) {
      const s = b.state;
      if (!s || !s.you || settled) return;
      const send = o => b.ws.readyState === 1 && b.ws.send(JSON.stringify(o));

      if (s.offer) return send({ type: 'offer', accept: Math.random() < 0.6 });
      if (b.isST && s.decision) return send({ type: 'decision', option: Math.random() < 0.8 ? pick(s.decision.options).id : '__auto' });

      if (s.phase === 'lobby' && b.first) {
        if (storyteller && !b.stSet) { b.stSet = true; return send({ type: 'setStoryteller', on: true }); }
        if (!b.scriptSet) { b.scriptSet = true; return send({ type: 'setScript', id: script }); }
        if (!b.started && s.seatedCount === size && s.scriptId === script && (!storyteller || s.storyteller)) {
          b.started = true; return setTimeout(() => send({ type: 'start' }), 200);
        }
        return;
      }
      if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
        const k = 'n' + s.dayNum + finished;
        if (!b.acted.has(k)) { b.acted.add(k); send({ type: 'nightAction', target: pick(s.actionPrompt.targets).id }); }
      }
      if (s.phase === 'day') {
        if (s.nomination && s.nomination.youEligible && !s.nomination.youVoted) send({ type: 'vote', yes: Math.random() < 0.6 });
        if (!s.nomination && s.canNominate && s.nominees) {
          const others = s.nominees.filter(t => t.id !== s.you.id);
          const k = 'nom' + s.dayNum + finished;
          if (others.length && !b.acted.has(k) && Math.random() < 0.5) { b.acted.add(k); send({ type: 'nominate', target: pick(others).id }); }
        }
        if (s.you.canShoot && Math.random() < 0.12) {
          const t = pick((s.players || []).filter(x => x.alive && x.id !== s.you.id && !x.storyteller));
          if (t) send({ type: 'shoot', target: t.id });
        }
        if (b.first) {
          const k = 'end' + s.dayNum + finished;
          if (!b.acted.has(k) && !s.nomination) { b.acted.add(k); setTimeout(() => { if (b.state.phase === 'day') send({ type: 'endDay' }); }, 500); }
        }
      }
      if (s.phase === 'over') {
        // sanity: the reveal must cover every seated player and name exactly one demon
        if (b.first && finished === 0) {
          const rev = s.reveal || [];
          if (rev.length !== size) fails.push(`${label}: reveal has ${rev.length} of ${size}`);
          const demons = rev.filter(r => r.kind === 'demon').length;
          if (demons !== 1) fails.push(`${label}: ${demons} demons in reveal`);
          if (!s.winner) fails.push(`${label}: finished with no winner`);
        }
        if (replay && finished === 0 && b.first) {
          finished = 1;
          return setTimeout(() => send({ type: 'newGame' }), 300);
        }
        if (!replay || finished === 1) { clearTimeout(timer); ran++; return done(true); }
      }
      // after "play again" the host must be able to start a second game
      if (replay && finished === 1 && s.phase === 'lobby' && b.first && !b.restarted) {
        b.restarted = true; setTimeout(() => send({ type: 'start' }), 300);
      }
    }
    bots.push(mk('Host', true));
  });
}

(async () => {
  const plan = [];
  for (let r = 0; r < ROUNDS; r++) {
    for (const script of SCRIPTS) for (const size of SIZES) plan.push({ size, script, storyteller: false });
    plan.push({ size: 7, script: 'maya', storyteller: true });
    plan.push({ size: 5, script: 'monsoon', storyteller: true });
    plan.push({ size: 9, script: 'amavas', storyteller: false, replay: true });
  }
  console.log(`running ${plan.length} games…`);
  for (const cfg of plan) await playOne(cfg);
  console.log(`\ncompleted ${ran}/${plan.length}`);
  if (fails.length) { console.log(`\n${fails.length} PROBLEM(S):`); fails.forEach(f => console.log('  -', f)); process.exit(1); }
  console.log('no problems found');
})();
