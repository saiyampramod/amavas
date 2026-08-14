// Demo helpers: N bots join the live game on port 3000 and play along.
// They act at night and vote by day, but never host. node demo-bots.js [count]
const WebSocket = require('ws');
const URL = 'ws://localhost:3000';
const COUNT = parseInt(process.argv[2] || '4', 10);
const names = ['Ravi', 'Meera', 'Arjun', 'Priya', 'Kabir', 'Anaya'].slice(0, COUNT);
const pick = a => a[Math.floor(Math.random() * a.length)];

function mkBot(name) {
  const ws = new WebSocket(URL);
  const bot = { name, ws, state: null, acted: new Set() };
  ws.on('open', () => ws.send(JSON.stringify({ type: 'join', name })));
  ws.on('message', raw => {
    const msg = JSON.parse(raw);
    if (msg.type === 'error') { console.log('ERR', name, msg.text); return; }
    if (msg.type !== 'state') return;
    bot.state = msg;
    setTimeout(() => act(bot), 400 + Math.random() * 1200);
  });
  ws.on('error', e => console.log('WSERR', name, e.message));
}

function act(bot) {
  const s = bot.state;
  if (!s || !s.you) return;
  const send = o => bot.ws.readyState === 1 && bot.ws.send(JSON.stringify(o));
  if (s.phase === 'night' && s.needsAction && s.actionPrompt) {
    const key = 'n' + s.dayNum;
    if (!bot.acted.has(key)) { bot.acted.add(key); send({ type: 'nightAction', target: pick(s.actionPrompt.targets).id }); }
  }
  if (s.phase === 'day') {
    if (s.nomination && s.nomination.youEligible && !s.nomination.youVoted) {
      send({ type: 'vote', yes: Math.random() < 0.55 });
    }
    if (!s.nomination && s.canNominate && s.nominees) {
      const others = s.nominees.filter(t => t.id !== s.you.id);
      const key = 'nom' + s.dayNum;
      if (others.length && Math.random() < 0.35 && !bot.acted.has(key)) {
        bot.acted.add(key); send({ type: 'nominate', target: pick(others).id });
      }
    }
  }
}

names.forEach((n, i) => setTimeout(() => mkBot(n), i * 200));
console.log(`${COUNT} demo villagers heading to the village...`);
