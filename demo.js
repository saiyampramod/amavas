// A playable demo: bots open a room, print the code, then wait for a human to join
// before starting. They play at a human pace so you have time to read and decide.
// node demo.js [botCount] [script] [port]
const WebSocket = require('ws');

const BOTS = parseInt(process.argv[2] || '6', 10);
const SCRIPT = process.argv[3] || 'amavas';
const PORT = process.argv[4] || '3000';
const URL = `ws://localhost:${PORT}`;

const NAMES = ['Ravi', 'Meera', 'Arjun', 'Priya', 'Kabir', 'Anaya', 'Vikram', 'Sneha', 'Rohit', 'Zoya'];
const pick = a => a[Math.floor(Math.random() * a.length)];

let ROOM = null, started = false, over = false, lastLog = 0;
const bots = [];

function mkBot(name, isHost) {
  const ws = new WebSocket(URL);
  const bot = { name, ws, isHost, state: null, acted: new Set() };
  ws.on('open', () => ws.send(JSON.stringify(isHost
    ? { type: 'join', name, create: true }
    : { type: 'join', name, code: ROOM })));
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'joined') {
      if (isHost) {
        ROOM = m.code;
        console.log('\n  ┌──────────────────────────────┐');
        console.log(`  │   ROOM CODE:  ${ROOM}           │`);
        console.log('  └──────────────────────────────┘');
        console.log(`  ${BOTS} bots are sitting down. Join them and the game begins.\n`);
        for (let i = 1; i < BOTS; i++) setTimeout(() => bots.push(mkBot(NAMES[i], false)), i * 120);
      }
      return;
    }
    if (m.type === 'error') { console.log('  !', name, m.text); return; }
    if (m.type !== 'state') return;
    bot.state = m;
    if (isHost && m.log.length > lastLog) {
      for (let i = lastLog; i < m.log.length; i++) console.log('  ·', m.log[i].text);
      lastLog = m.log.length;
    }
    setTimeout(() => act(bot), 400 + Math.random() * 900);
  });
  ws.on('error', e => console.log('  ! socket', name, e.message));
  return bot;
}

function act(bot) {
  const s = bot.state;
  if (!s || !s.you || over) return;
  const send = o => bot.ws.readyState === 1 && bot.ws.send(JSON.stringify(o));

  // a secret offer to switch sides — bots usually take it, it makes for a better story
  if (s.offer) { send({ type: 'offer', accept: Math.random() < 0.7 }); return; }

  if (bot.isHost && s.phase === 'lobby') {
    if (!bot.scriptSet) { bot.scriptSet = true; send({ type: 'setScript', id: SCRIPT }); return; }
    // wait for a real person before starting
    if (!started && s.seatedCount > BOTS && s.scriptId === SCRIPT) {
      started = true;
      console.log('\n  A human sat down. Starting in 3 seconds…\n');
      setTimeout(() => send({ type: 'start' }), 3000);
    }
    return;
  }

  if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
    const key = 'n' + s.dayNum;
    if (!bot.acted.has(key)) {
      bot.acted.add(key);
      setTimeout(() => send({ type: 'nightAction', target: pick(s.actionPrompt.targets).id }), 1500 + Math.random() * 2500);
    }
  }

  if (s.phase === 'day') {
    // vote, but slowly, so a human sees the tally move
    if (s.nomination && s.nomination.youEligible && !s.nomination.youVoted) {
      const key = 'v' + s.dayNum + s.nomination.nominee;
      if (!bot.acted.has(key)) {
        bot.acted.add(key);
        setTimeout(() => send({ type: 'vote', yes: Math.random() < 0.55 }), 2000 + Math.random() * 5000);
      }
    }
    // one bot accusation per day, after a pause for "discussion"
    if (!s.nomination && s.canNominate && s.nominees) {
      const others = s.nominees.filter(t => t.id !== s.you.id);
      const key = 'nom' + s.dayNum;
      if (others.length && !bot.acted.has(key) && Math.random() < 0.35) {
        bot.acted.add(key);
        setTimeout(() => { if (bot.state.phase === 'day' && !bot.state.nomination) send({ type: 'nominate', target: pick(others).id }); },
          6000 + Math.random() * 6000);
      }
    }
    // the host closes the day generously late, so you are never rushed
    if (bot.isHost) {
      const key = 'end' + s.dayNum;
      if (!bot.acted.has(key)) {
        bot.acted.add(key);
        setTimeout(() => { if (bot.state.phase === 'day' && !over) send({ type: 'endDay' }); }, 45000);
      }
    }
  }

  if (s.phase === 'over' && !over) {
    over = true;
    console.log(`\n  === ${s.winner === 'good' ? 'GOOD WINS' : 'EVIL WINS'} — ${s.winReason}`);
    (s.directorLog || []).forEach(d => console.log('    (unseen storyteller) N' + (d.day + 1) + ':', d.text));
    console.log('\n  Demo finished. The host can tap Play again for another round.\n');
  }
}

console.log(`\n  Opening an AMAVAS demo room — story mode: ${SCRIPT}`);
bots.push(mkBot(NAMES[0], true));
