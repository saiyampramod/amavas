// With a short grace: owner goes dark long enough that someone stands in,
// then returns and must get the controls back automatically.
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const N = 5;
let code = null, ownerToken = null;
const bots = [];
const fails = [];
const hostNow = s => ((s.players || []).find(p => p.host) || {}).name;

function mk(name, first, token) {
  const ws = new WebSocket(URL);
  const b = { name, ws, first, state: null };
  ws.on('open', () => ws.send(JSON.stringify(
    token ? { type: 'join', token }
          : first ? { type: 'join', name, create: true } : { type: 'join', name, code })));
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'joined') {
      if (first && !code) {
        code = m.code; ownerToken = m.token;
        for (let i = 1; i < N; i++) setTimeout(() => bots.push(mk('P' + i, false)), i * 40);
      }
      return;
    }
    if (m.type === 'state') b.state = m;
  });
  ws.on('error', () => {});
  return b;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const watcher = () => bots.find(b => b.name === 'P1');

(async () => {
  bots.push(mk('Owner', true));
  await wait(2500);
  console.log('host at start:', hostNow(watcher().state));

  console.log('\n-- owner goes dark past the grace period --');
  bots[0].ws.close();
  await wait(26000);                       // grace 5s + reaper runs every 15s
  const lent = hostNow(watcher().state);
  console.log('host while owner is away:', lent);
  if (lent === 'Owner') fails.push('nobody stood in while the owner was away');

  console.log('\n-- owner comes back --');
  bots[0] = mk('Owner', false, ownerToken);
  await wait(2500);
  const back = hostNow(watcher().state);
  console.log('host after owner returns:', back);
  if (back !== 'Owner') fails.push(`owner did not get the controls back (host is ${back})`);

  console.log('\n' + (fails.length ? 'FAIL:\n  ' + fails.join('\n  ') : 'PASS — lent out while away, returned on arrival'));
  process.exit(fails.length ? 1 : 0);
})();
setTimeout(() => { console.log('timeout'); process.exit(1); }, 70000);
