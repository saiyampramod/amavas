// Smoke test: N bots play AMAVAS to completion with random choices.  node smoke.js [count]
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const COUNT = Math.min(20, Math.max(5, parseInt(process.argv[2] || '6', 10)));
const SCRIPT = process.argv[3] || 'amavas';
const TAG = process.argv[4] || 'Bot';           // lets two suites share one server
const names = Array.from({ length: COUNT }, (_, i) => TAG + (i + 1));
const bots = [];
let logLen = 0, done = false, ROOM = null;
const pick = a => a[Math.floor(Math.random() * a.length)];

function mkBot(name, isHost) {
  const ws = new WebSocket(URL);
  const bot = { name, ws, state: null, isHost, acted: new Set() };
  ws.on('open', () => ws.send(JSON.stringify(isHost
    ? { type: 'join', name, create: true }
    : { type: 'join', name, code: ROOM })));
  ws.on('message', raw => {
    const msg = JSON.parse(raw);
    if (msg.type === 'joined') { if (isHost) { ROOM = msg.code; spawnRest(); } return; }
    if (msg.type === 'error') { console.log('ERR', name, msg.text); return; }
    if (msg.type !== 'state') return;
    bot.state = msg;
    if (name === TAG + '1' && msg.log.length > logLen) {
      for (let i = logLen; i < msg.log.length; i++) console.log('LOG:', msg.log[i].text);
      logLen = msg.log.length;
    }
    setTimeout(() => act(bot), 30 + Math.random() * 80);
  });
  ws.on('error', e => console.log('WSERR', name, e.message));
  return bot;
}

function act(bot) {
  if (done) return;
  const s = bot.state;
  if (!s || !s.you) return;
  const send = o => bot.ws.readyState === 1 && bot.ws.send(JSON.stringify(o));
  if (s.phase === 'lobby' && bot.isHost && s.players.length === COUNT) {
    if (!bot.scriptSet) { bot.scriptSet = true; send({ type: 'setScript', id: SCRIPT }); return; }
    if (!bot.started && s.scriptId === SCRIPT) {
      bot.started = true;
      console.log(`--- ${SCRIPT} · ${COUNT} players ---`);
      send({ type: 'start' });
    }
  }
  if (s.offer) { send({ type: 'offer', accept: Math.random() < 0.6 }); return; }
  if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
    const key = 'n' + s.dayNum;
    if (!bot.acted.has(key)) { bot.acted.add(key); send({ type: 'nightAction', target: pick(s.actionPrompt.targets).id }); }
  }
  if (s.phase === 'day') {
    if (s.nomination && s.nomination.youEligible && !s.nomination.youVoted) {
      send({ type: 'vote', yes: Math.random() < 0.6 });
    }
    if (!s.nomination && s.canNominate && s.nominees) {
      const others = s.nominees.filter(t => t.id !== s.you.id);
      const key = 'nom' + s.dayNum;
      if (others.length && Math.random() < 0.4 && !bot.acted.has(key)) {
        bot.acted.add(key); send({ type: 'nominate', target: pick(others).id });
      }
    }
    if (s.you.canShoot && Math.random() < 0.15) {
      const targets = s.players.filter(t => t.alive && t.id !== s.you.id);
      if (targets.length) send({ type: 'shoot', target: pick(targets).id });
    }
    if (bot.isHost) {
      const key = 'end' + s.dayNum;
      if (!bot.acted.has(key) && !s.nomination) {
        bot.acted.add(key);
        setTimeout(() => { if (bot.state.phase === 'day' && !done) bot.ws.send(JSON.stringify({ type: 'endDay' })); }, 1500);
      }
    }
  }
  if (s.phase === 'over' && !done) {
    done = true;
    console.log('=== GAME OVER:', s.winner, '—', s.winReason);
    (s.directorLog || []).forEach(d => console.log('    DIRECTOR N' + (d.day + 1) + ':', d.text));
    setTimeout(() => process.exit(0), 300);
  }
}

function spawnRest() {
  names.slice(1).forEach((n, i) => setTimeout(() => bots.push(mkBot(n, false)), i * 55));
}
bots.push(mkBot(names[0], true));   // host creates the room, the rest join by code
setTimeout(() => { console.log('TIMEOUT — game did not finish. Last phase:', bots[0] && bots[0].state && bots[0].state.phase); process.exit(1); }, 120000);
