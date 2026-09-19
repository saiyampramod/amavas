// A dead player gets exactly one ghost vote. Kills a player, then tries to vote YES
// twice across two nominations and checks the second one does not land.
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const N = 7;                       // players besides the storyteller
let code = null, ghostId = null, done = false;
const bots = [];
const fails = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const me = name => bots.find(b => b.name === name);

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
    if (b.isST && m.decision) ws.send(JSON.stringify({ type: 'decision', option: '__auto' }));
    if (m.offer) ws.send(JSON.stringify({ type: 'offer', accept: false }));
    // everyone answers their night prompt so nights resolve
    if (!b.isST && m.phase === 'night' && m.needsAction && m.actionPrompt) {
      const k = 'n' + m.dayNum;
      if (!b.acted.has(k)) { b.acted.add(k); ws.send(JSON.stringify({ type: 'nightAction', target: m.actionPrompt.targets[0].id })); }
    }
  });
  ws.on('error', () => {});
  return b;
}
const send = (b, o) => b.ws.readyState === 1 && b.ws.send(JSON.stringify(o));

(async () => {
  bots.push(mk('Teller', true));
  await wait(2500);
  const st = bots[0];
  send(st, { type: 'setStoryteller', on: true });
  await wait(600);
  send(st, { type: 'start' });
  await wait(2500);

  // kill P1 outright so they become a ghost
  const grim = st.state.grimoire || [];
  const victim = grim.find(g => g.name === 'P1');
  ghostId = victim.id;
  send(st, { type: 'stAction', target: ghostId, action: 'kill' });
  await wait(1200);

  // get to day
  for (let i = 0; i < 30 && st.state.phase !== 'day'; i++) await wait(400);
  if (st.state.phase !== 'day') { console.log('never reached day'); process.exit(1); }

  const ghost = me('P1');
  console.log('P1 alive?', ghost.state.you.alive, '| ghost vote?', ghost.state.you.ghostVote);
  if (ghost.state.you.alive) fails.push('P1 was not killed');

  // ---- first ghost vote (should count)
  const t1 = (ghost.state.nominees || []).find(x => x.name !== 'P1');
  send(me('P2'), { type: 'nominate', target: t1.id });
  await wait(900);
  send(ghost, { type: 'vote', yes: true });
  await wait(900);
  const afterFirst = ghost.state.you.ghostVote;
  console.log('after first YES, ghost vote left?', afterFirst);
  if (afterFirst !== false) fails.push('ghost vote was not spent by voting YES');

  // let that vote close
  send(st, { type: 'closeNomination' });
  await wait(900);

  // ---- second ghost vote (must be refused)
  const t2 = (me('P3').state.nominees || []).find(x => x.name !== 'P1');
  if (t2) {
    send(me('P3'), { type: 'nominate', target: t2.id });
    await wait(900);
    const n = ghost.state.nomination;
    const eligible = n ? n.youEligible : null;
    console.log('second nomination — ghost eligible?', eligible);
    if (eligible) fails.push('a spent ghost was still eligible to vote');
    // try anyway, straight over the wire
    send(ghost, { type: 'vote', yes: true });
    await wait(900);
    const n2 = ghost.state.nomination;
    if (n2 && n2.voted && n2.voted.includes('P1')) fails.push('the spent ghost vote was accepted anyway');
    console.log('votes recorded this round:', n2 ? n2.voted.join(', ') : '(closed)');
  }

  console.log('\n' + (fails.length ? 'FAIL:\n  ' + fails.join('\n  ') : 'PASS — exactly one ghost vote'));
  done = true;
  process.exit(fails.length ? 1 : 0);
})();
setTimeout(() => { if (!done) { console.log('timeout'); process.exit(1); } }, 60000);
