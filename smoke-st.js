// Storyteller smoke test: one bot storytells (answering every judgement call),
// the rest play. Proves the night pauses for decisions and still resolves.
// node smoke-st.js [players] [script]
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const COUNT = Math.max(5, parseInt(process.argv[2] || '7', 10));
const SCRIPT = process.argv[3] || 'amavas';
const pick = a => a[Math.floor(Math.random() * a.length)];

let done = false, logLen = 0, decisions = 0, whispers = 0, ROOM = null;
const bots = [];

function mkBot(name, isST) {
  const ws = new WebSocket(URL);
  const bot = { name, ws, state: null, isST, acted: new Set() };
  ws.on('open', () => ws.send(JSON.stringify(isST
    ? { type: 'join', name, create: true }
    : { type: 'join', name, code: ROOM })));
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'joined') { if (isST) { ROOM = m.code; spawnPlayers(); } return; }
    if (m.type === 'error') { console.log('ERR', name, m.text); return; }
    if (m.type !== 'state') return;
    bot.state = m;
    if (isST && m.log.length > logLen) {
      for (let i = logLen; i < m.log.length; i++) console.log('LOG:', m.log[i].text);
      logLen = m.log.length;
    }
    setTimeout(() => act(bot), 25 + Math.random() * 60);
  });
  ws.on('error', e => console.log('WSERR', name, e.message));
  return bot;
}

function act(bot) {
  if (done) return;
  const s = bot.state;
  if (!s || !s.you) return;
  const send = o => bot.ws.readyState === 1 && bot.ws.send(JSON.stringify(o));

  if (bot.isST) {
    if (s.phase === 'lobby') {
      if (!bot.stSet) { bot.stSet = true; send({ type: 'setStoryteller', on: true }); return; }
      if (!bot.scriptSet) { bot.scriptSet = true; send({ type: 'setScript', id: SCRIPT }); return; }
      if (!bot.started && s.seatedCount === COUNT && s.storyteller && s.scriptId === SCRIPT) {
        bot.started = true;
        console.log(`--- ${SCRIPT} · ${COUNT} players + storyteller ---`);
        send({ type: 'start' });
      }
      return;
    }
    // answer every judgement call
    if (s.decision) {
      decisions++;
      const opt = Math.random() < 0.75 ? pick(s.decision.options).id : '__auto';
      send({ type: 'decision', option: opt });
      return;
    }
    // occasionally whisper to someone, exercising the private-message path
    if (s.phase === 'day' && s.grimoire && whispers < 3 && Math.random() < 0.25) {
      const t = pick(s.grimoire.filter(g => g.alive));
      if (t) { whispers++; send({ type: 'stMessage', target: t.id, text: 'A little bird says watch the quiet one.' }); }
    }
    if (s.phase === 'day') {
      const key = 'end' + s.dayNum;
      if (!bot.acted.has(key) && !s.nomination) {
        bot.acted.add(key);
        setTimeout(() => { if (bot.state.phase === 'day' && !done) send({ type: 'endDay' }); }, 1200);
      }
    }
    if (s.phase === 'over' && !done) {
      done = true;
      console.log(`=== GAME OVER: ${s.winner} — ${s.winReason}`);
      console.log(`=== storyteller answered ${decisions} judgement call(s), sent ${whispers} whisper(s)`);
      console.log('=== grimoire visible to ST:', (s.grimoire || []).length, 'players');
      console.log('=== director stayed out:', (s.directorLog || []).length === 0 ? 'yes' : 'NO — ' + s.directorLog.length + ' entries');
      setTimeout(() => process.exit(0), 250);
    }
    return;
  }

  // ordinary players
  if (s.offer) { send({ type: 'offer', accept: Math.random() < 0.6 }); return; }
  if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
    const key = 'n' + s.dayNum;
    if (!bot.acted.has(key)) { bot.acted.add(key); send({ type: 'nightAction', target: pick(s.actionPrompt.targets).id }); }
  }
  if (s.phase === 'day') {
    if (s.nomination && s.nomination.youEligible && !s.nomination.youVoted) send({ type: 'vote', yes: Math.random() < 0.6 });
    if (!s.nomination && s.canNominate && s.nominees) {
      const others = s.nominees.filter(t => t.id !== s.you.id);
      const key = 'nom' + s.dayNum;
      if (others.length && Math.random() < 0.45 && !bot.acted.has(key)) {
        bot.acted.add(key); send({ type: 'nominate', target: pick(others).id });
      }
    }
  }
}

function spawnPlayers() {
  for (let i = 0; i < COUNT; i++) setTimeout(() => bots.push(mkBot('P' + (i + 1), false)), i * 55);
}
bots.push(mkBot('Teller', true));   // storyteller creates the room
setTimeout(() => {
  console.log('TIMEOUT — phase:', bots[0].state && bots[0].state.phase,
    '| pending decision:', !!(bots[0].state && bots[0].state.decision));
  process.exit(1);
}, 90000);
