// Does the same table get the same roles game after game?
// Plays N games in ONE room via "play again" and reports how often each player
// repeats their previous role. Pure chance for 12 seats is roughly 10-15%.
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const SIZE = 9, GAMES = 12;

let code = null, gameNo = 0, settled = false;
const bots = [];
const history = {};            // name -> [role per game]

function mk(name, first) {
  const ws = new WebSocket(URL);
  const b = { name, ws, first, state: null, acted: new Set() };
  ws.on('open', () => ws.send(JSON.stringify(first
    ? { type: 'join', name, create: true } : { type: 'join', name, code })));
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'joined' && first) {
      code = m.code;
      for (let i = 1; i < SIZE; i++) setTimeout(() => bots.push(mk('P' + i, false)), i * 30);
      return;
    }
    if (m.type !== 'state') return;
    b.state = m;
    setTimeout(() => act(b), 8 + Math.random() * 20);
  });
  ws.on('error', () => {});
  return b;
}

function act(b) {
  const s = b.state;
  if (!s || !s.you || settled) return;
  const send = o => b.ws.readyState === 1 && b.ws.send(JSON.stringify(o));
  if (s.offer) return send({ type: 'offer', accept: false });

  if (s.phase === 'lobby' && b.first && s.seatedCount === SIZE) {
    const k = 'start' + gameNo;
    if (!b.acted.has(k)) { b.acted.add(k); setTimeout(() => send({ type: 'start' }), 150); }
    return;
  }
  // Record exactly once per game, driven by this bot's own view: roles are cleared to
  // null between games, so a null->role transition is one deal. (Keying off the host's
  // game counter races and double-counts a stale role as a "repeat".)
  if (!s.you.role) b.recorded = false;
  if (s.you.role && !b.recorded) {
    b.recorded = true;
    (history[b.name] = history[b.name] || []).push(s.you.role);
  }
  // race to the end: everyone votes yes on anything
  if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
    const k = 'n' + gameNo + s.dayNum;
    if (!b.acted.has(k)) { b.acted.add(k); send({ type: 'nightAction', target: s.actionPrompt.targets[0].id }); }
  }
  if (s.phase === 'day') {
    if (s.nomination && s.nomination.youEligible && !s.nomination.youVoted) return send({ type: 'vote', yes: true });
    if (!s.nomination && s.canNominate && s.nominees) {
      const others = s.nominees.filter(t => t.id !== s.you.id);
      const k = 'nom' + gameNo + s.dayNum;
      if (others.length && !b.acted.has(k)) { b.acted.add(k); return send({ type: 'nominate', target: others[0].id }); }
    }
    if (b.first) {
      const k = 'end' + gameNo + s.dayNum;
      if (!b.acted.has(k) && !s.nomination) { b.acted.add(k); setTimeout(() => send({ type: 'endDay' }), 120); }
    }
  }
  if (s.phase === 'over' && b.first) {
    const k = 'again' + gameNo;
    if (b.acted.has(k)) return;
    b.acted.add(k);
    gameNo++;
    if (gameNo >= GAMES) return report();
    setTimeout(() => send({ type: 'newGame' }), 150);
  }
}

function report() {
  settled = true;
  const names = Object.keys(history);
  let repeats = 0, comparisons = 0;
  const worst = [];
  for (const n of names) {
    const h = history[n];
    let r = 0;
    for (let i = 1; i < h.length; i++) { comparisons++; if (h[i] === h[i - 1]) { repeats++; r++; } }
    if (r) worst.push(`${n} repeated ${r}x — ${h.join(' → ')}`);
  }
  const pct = comparisons ? (100 * repeats / comparisons) : 0;
  console.log(`games recorded: ${Math.max(...names.map(n => history[n].length))}, players: ${names.length}`);
  console.log(`back-to-back same role: ${repeats}/${comparisons} = ${pct.toFixed(1)}%`);
  worst.slice(0, 4).forEach(w => console.log('  ', w));
  // For 9 seats drawing from this pool, pure chance is ~8%. Anything past ~20% is a real bias.
  const bad = pct > 20;
  console.log(bad ? 'FAIL — roles look sticky between games' : 'PASS — reshuffles look random');
  process.exit(bad ? 1 : 0);
}

bots.push(mk('Kishan', true));
setTimeout(() => { console.log('timeout at game', gameNo); report(); }, 90000);
