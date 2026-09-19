// With no "spare" for ghosts, a vote must close once the living have voted —
// otherwise a silent ghost would hang the game forever.
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const N = 7;
let code = null, done = false;
const bots = [];
const fails = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const me = n => bots.find(b => b.name === n);
const send = (b, o) => b.ws.readyState === 1 && b.ws.send(JSON.stringify(o));

function mk(name, isST) {
  const ws = new WebSocket(URL);
  const b = { name, ws, isST, state: null, acted: new Set() };
  ws.on('open', () => ws.send(JSON.stringify(isST
    ? { type: 'join', name, create: true } : { type: 'join', name, code })));
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'joined' && isST) {
      code = m.code;
      for (let i = 1; i <= N; i++) setTimeout(() => bots.push(mk('P' + i, false)), i * 40);
      return;
    }
    if (m.type !== 'state') return;
    b.state = m;
    if (b.isST && m.decision) send(b, { type: 'decision', option: '__auto' });
    if (m.offer) send(b, { type: 'offer', accept: false });
    if (!b.isST && m.phase === 'night' && m.needsAction && m.actionPrompt) {
      const k = 'n' + m.dayNum;
      if (!b.acted.has(k)) { b.acted.add(k); send(b, { type: 'nightAction', target: m.actionPrompt.targets[0].id }); }
    }
  });
  ws.on('error', () => {});
  return b;
}

(async () => {
  bots.push(mk('Teller', true));
  await wait(2500);
  const st = bots[0];
  send(st, { type: 'setStoryteller', on: true });
  await wait(600);
  send(st, { type: 'start' });
  await wait(2500);

  const ghost = (st.state.grimoire || []).find(g => g.name === 'P1');
  send(st, { type: 'stAction', target: ghost.id, action: 'kill' });
  await wait(1200);
  for (let i = 0; i < 30 && st.state.phase !== 'day'; i++) await wait(400);

  const target = (me('P2').state.nominees || []).find(x => x.name !== 'P2');
  send(me('P2'), { type: 'nominate', target: target.id });
  await wait(900);

  console.log('ghost is silent on purpose; every living player votes...');
  for (const b of bots) {
    if (b.isST || b.name === 'P1') continue;
    if (b.state && b.state.nomination && !b.state.nomination.youVoted) send(b, { type: 'vote', yes: false });
  }
  await wait(2500);

  const stillOpen = !!(me('P2').state.nomination);
  console.log('nomination still open after all living voted?', stillOpen);
  if (stillOpen) fails.push('the vote hung waiting on a silent ghost');

  const p1 = me('P1').state;
  console.log('ghost kept their vote?', p1.you.ghostVote);
  if (!p1.you.ghostVote) fails.push('a silent ghost lost their vote anyway');

  console.log('\n' + (fails.length ? 'FAIL:\n  ' + fails.join('\n  ') : 'PASS — votes close without waiting on ghosts'));
  done = true;
  process.exit(fails.length ? 1 : 0);
})();
setTimeout(() => { if (!done) { console.log('timeout'); process.exit(1); } }, 60000);
