// Failure test: the Storyteller closes their phone while a judgement call is open.
// The night must fall back to the engine and finish, not hang forever.
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const COUNT = 12, SCRIPT = 'maya';
const pick = a => a[Math.floor(Math.random() * a.length)];
let dropped = false, sawDecision = false, finished = false, ROOM = null;
const bots = [];

function mkBot(name, isST) {
  const ws = new WebSocket(URL);
  const bot = { name, ws, isST, acted: new Set(), state: null };
  ws.on('open', () => ws.send(JSON.stringify(isST
    ? { type: 'join', name, create: true }
    : { type: 'join', name, code: ROOM })));
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'joined') { if (isST) { ROOM = m.code; spawnPlayers(); } return; }
    if (m.type !== 'state') return;
    bot.state = m;
    setTimeout(() => act(bot), 25 + Math.random() * 50);
  });
  ws.on('error', () => {});
  return bot;
}

function act(bot) {
  const s = bot.state;
  if (!s || !s.you || finished) return;
  const send = o => bot.ws.readyState === 1 && bot.ws.send(JSON.stringify(o));

  if (bot.isST) {
    if (s.phase === 'lobby') {
      if (!bot.a) { bot.a = 1; send({ type: 'setStoryteller', on: true }); return; }
      if (!bot.b) { bot.b = 1; send({ type: 'setScript', id: SCRIPT }); return; }
      if (!bot.c && s.seatedCount === COUNT && s.storyteller) { bot.c = 1; send({ type: 'start' }); }
      return;
    }
    // The moment a judgement call appears, walk away and never answer it.
    if (s.decision && !dropped) {
      sawDecision = true; dropped = true;
      console.log('storyteller sees a judgement call:', JSON.stringify(s.decision.title));
      console.log('...closing their phone without answering');
      bot.ws.close();
      return;
    }
    if (s.phase === 'day') {
      const k = 'end' + s.dayNum;
      if (!bot.acted.has(k) && !s.nomination) { bot.acted.add(k); setTimeout(() => send({ type: 'endDay' }), 900); }
    }
    return;
  }

  // players carry on; one of them ends days once the ST is gone
  if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
    const k = 'n' + s.dayNum;
    if (!bot.acted.has(k)) { bot.acted.add(k); send({ type: 'nightAction', target: pick(s.actionPrompt.targets).id }); }
  }
  if (s.phase === 'day') {
    if (s.nomination && s.nomination.youEligible && !s.nomination.youVoted) send({ type: 'vote', yes: Math.random() < 0.6 });
    if (s.you.host) {
      const k = 'end' + s.dayNum;
      if (!bot.acted.has(k) && !s.nomination) { bot.acted.add(k); setTimeout(() => send({ type: 'endDay' }), 900); }
    }
  }
  if (s.phase === 'over' && !finished) {
    finished = true;
    console.log('=== game still finished:', s.winner, '—', s.winReason);
    console.log('=== decision was raised:', sawDecision, '| storyteller dropped:', dropped);
    setTimeout(() => process.exit(0), 200);
  }
}

function spawnPlayers() {
  for (let i = 0; i < COUNT; i++) setTimeout(() => bots.push(mkBot('P' + (i + 1), false)), i * 55);
}
bots.push(mkBot('Teller', true));
setTimeout(() => {
  const s = bots[1] && bots[1].state;
  console.log('TIMEOUT — the night HUNG. phase:', s && s.phase, 'day:', s && s.dayNum);
  process.exit(1);
}, 60000);
