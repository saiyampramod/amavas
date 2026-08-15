// A demo where YOU are the host and the Storyteller.
// Bots open a room, print the code, and hand you the controls the moment you join.
// You then pick Storyteller mode, start the game, and run it.
// node demo-st.js [botCount] [script] [port]
const WebSocket = require('ws');

const BOTS = parseInt(process.argv[2] || '6', 10);
const SCRIPT = process.argv[3] || 'monsoon';
const PORT = process.argv[4] || '3000';
const URL = `ws://localhost:${PORT}`;

const NAMES = ['Ravi', 'Meera', 'Arjun', 'Priya', 'Kabir', 'Anaya', 'Vikram', 'Sneha', 'Rohit', 'Zoya'];
const pick = a => a[Math.floor(Math.random() * a.length)];

let ROOM = null, handedOver = false, lastLog = 0, over = false;
const bots = [];

function mkBot(name, isFirst) {
  const ws = new WebSocket(URL);
  const bot = { name, ws, isFirst, state: null, acted: new Set() };
  ws.on('open', () => ws.send(JSON.stringify(isFirst
    ? { type: 'join', name, create: true } : { type: 'join', name, code: ROOM })));
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'joined') {
      if (isFirst) {
        ROOM = m.code;
        console.log('\n  ┌──────────────────────────────┐');
        console.log(`  │   ROOM CODE:  ${ROOM}           │`);
        console.log('  └──────────────────────────────┘');
        console.log(`  Story mode: ${SCRIPT}`);
        console.log(`  ${BOTS} bots seated. Join and they will hand you the controls.\n`);
        for (let i = 1; i < BOTS; i++) setTimeout(() => bots.push(mkBot(NAMES[i], false)), i * 120);
      }
      return;
    }
    if (m.type === 'error') { console.log('  !', name, m.text); return; }
    if (m.type !== 'state') return;
    bot.state = m;
    if (isFirst && m.log.length > lastLog) {
      for (let i = lastLog; i < m.log.length; i++) console.log('  ·', m.log[i].text);
      lastLog = m.log.length;
    }
    setTimeout(() => act(bot), 500 + Math.random() * 900);
  });
  ws.on('error', e => console.log('  ! socket', name, e.message));
  return bot;
}

function act(bot) {
  const s = bot.state;
  if (!s || !s.you || over) return;
  const send = o => bot.ws.readyState === 1 && bot.ws.send(JSON.stringify(o));

  if (s.offer) return send({ type: 'offer', accept: Math.random() < 0.7 });

  // the moment a human sits down, give them the crown and get out of the way
  if (bot.isFirst && s.phase === 'lobby' && !handedOver && s.seatedCount > BOTS) {
    const human = s.players.find(p => !NAMES.includes(p.name) && p.connected);
    if (human) {
      handedOver = true;
      console.log(`\n  ${human.name} joined — handing over host.`);
      console.log('  On your phone: pick "Storyteller mode", then Begin the first night.\n');
      send({ type: 'makeHost', target: human.id });
    }
    return;
  }

  if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
    const key = 'n' + s.dayNum;
    if (!bot.acted.has(key)) {
      bot.acted.add(key);
      setTimeout(() => send({ type: 'nightAction', target: pick(s.actionPrompt.targets).id }),
        1500 + Math.random() * 3000);
    }
  }

  if (s.phase === 'day') {
    if (s.nomination && s.nomination.youEligible && !s.nomination.youVoted) {
      const key = 'v' + s.dayNum + s.nomination.nominee;
      if (!bot.acted.has(key)) {
        bot.acted.add(key);
        setTimeout(() => send({ type: 'vote', yes: Math.random() < 0.55 }), 2500 + Math.random() * 5000);
      }
    }
    if (!s.nomination && s.canNominate && s.nominees) {
      const others = s.nominees.filter(t => t.id !== s.you.id);
      const key = 'nom' + s.dayNum;
      if (others.length && !bot.acted.has(key) && Math.random() < 0.4) {
        bot.acted.add(key);
        setTimeout(() => { if (bot.state.phase === 'day' && !bot.state.nomination) send({ type: 'nominate', target: pick(others).id }); },
          7000 + Math.random() * 7000);
      }
    }
    // NOTE: bots never end the day. That is the Storyteller's job — yours.
  }

  if (s.phase === 'over' && !over) {
    over = true;
    console.log(`\n  === ${s.winner === 'good' ? 'GOOD WINS' : 'EVIL WINS'} — ${s.winReason}\n`);
  }
}

console.log(`\n  Opening a Storyteller demo — you will run this one.`);
bots.push(mkBot(NAMES[0], true));
