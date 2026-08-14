// A phone that reconnects with a token for a room that no longer exists must be sent
// back to the front door, not left staring at a frozen screen.
const WebSocket = require('ws');
const URL = 'ws://localhost:3100';

const ws = new WebSocket(URL);
let sawLeft = false, sawError = null;
ws.on('open', () => ws.send(JSON.stringify({ type: 'join', token: 'a-token-from-a-server-that-restarted' })));
ws.on('message', raw => {
  const m = JSON.parse(raw);
  if (m.type === 'left') sawLeft = true;
  if (m.type === 'error') sawError = m.text;
  if (sawLeft && sawError) {
    console.log('server replied: left + "' + sawError + '"');
    console.log('PASS — a stale session is cleared instead of hanging');
    process.exit(0);
  }
});
ws.on('error', e => { console.log('FAIL', e.message); process.exit(1); });
setTimeout(() => {
  console.log(`FAIL — no recovery. left=${sawLeft} error=${sawError}`);
  process.exit(1);
}, 8000);
