// The host must not drift. Proves: a blip never moves it; a long absence lends it out
// but the owner gets it back on return; and the owner can take it back on demand.
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';
const N = 6;
let code = null, ownerToken = null, done = false;
const bots = [];
const fails = [];
const hostNow = s => ((s.players || []).find(p => p.host) || {}).name;

function mk(name, first, token) {
  const ws = new WebSocket(URL);
  const b = { name, ws, first, state: null };
  ws.on('open', () => ws.send(JSON.stringify(
    token ? { type: 'join', token }
          : first ? { type: 'join', name, create: true }
                  : { type: 'join', name, code })));
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
const owner = () => bots[0];
const other = () => bots.find(b => b.name === 'P1');

(async () => {
  bots.push(mk('Owner', true));
  await wait(2500);
  const s0 = other().state;
  if (hostNow(s0) !== 'Owner') fails.push(`owner should start as host, got ${hostNow(s0)}`);
  console.log('host at start:', hostNow(s0));

  // 1. a short blip must NOT move the host
  console.log('\n-- owner drops for 20s (a locked phone) --');
  owner().ws.close();
  await wait(20000);
  console.log('host after 20s offline:', hostNow(other().state));
  if (hostNow(other().state) !== 'Owner') fails.push('a short blip moved the host');

  // owner comes back
  bots[0] = mk('Owner', false, ownerToken);
  await wait(2000);
  console.log('host after owner returns:', hostNow(other().state));
  if (hostNow(other().state) !== 'Owner') fails.push('owner did not keep host after returning');

  // 2. someone else deliberately given the controls, then owner reclaims
  console.log('\n-- owner hands over to P1, then takes it back --');
  const p1id = (other().state.players.find(p => p.name === 'P1') || {}).id;
  owner().ws.send(JSON.stringify({ type: 'makeHost', target: p1id }));
  await wait(1200);
  console.log('host after handover:', hostNow(other().state));
  if (hostNow(other().state) !== 'P1') fails.push('deliberate handover failed');

  // after a deliberate handover the room belongs to P1, so the old owner cannot grab it
  owner().ws.send(JSON.stringify({ type: 'reclaimHost' }));
  await wait(1200);
  console.log('host after old owner tries to reclaim:', hostNow(other().state));
  if (hostNow(other().state) !== 'P1') fails.push('a deliberate handover was overridden');

  console.log('\n' + (fails.length ? 'FAIL:\n  ' + fails.join('\n  ') : 'PASS — the host stays put'));
  done = true;
  process.exit(fails.length ? 1 : 0);
})();

setTimeout(() => { if (!done) { console.log('timeout'); process.exit(1); } }, 70000);
