/* AMAVAS client — cyber-noir dossier UI */
const app = () => document.getElementById('app');
const overlay = () => document.getElementById('overlay');
let ws, state = null, myToken = localStorage.getItem('nf_token');
let joinError = '', selected = null, sheet = null, drawer = false, roleOpen = false, sheetScript = null;
let whisperTo = null;
let lastName = localStorage.getItem('nf_name') || '';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const send = o => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
const ms = (n, cls) => `<span class="ms ${cls || ''}">${n}</span>`;

// ---------------------------------------------------------------- socket
function connect() {
  let delay = 800;
  const open = () => {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => { delay = 800; if (myToken) send({ type: 'join', token: myToken }); };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === 'joined') { myToken = m.token; localStorage.setItem('nf_token', myToken); }
      else if (m.type === 'left') {
        myToken = null; localStorage.removeItem('nf_token');
        state = null; joinError = ''; render();
      }
      else if (m.type === 'error') { joinError = m.text; render(); }
      else if (m.type === 'state') {
        if (state && state.phase !== m.phase) { selected = null; sheet = null; }
        state = m; joinError = ''; render();
      }
    };
    ws.onclose = () => { setTimeout(open, delay); delay = Math.min(delay * 2, 15000); };
    ws.onerror = () => ws.close();
  };
  open();
}

// ---------------------------------------------------------------- chrome
function topBar() {
  return `<header class="fixed top-0 w-full z-40 h-16 px-margin-sm flex justify-between items-center
      bg-surface/80 backdrop-blur-xl border-b border-white/10">
    <button data-act="drawer" class="p-2 -ml-2 text-on-surface-variant active:scale-95 transition">${ms('receipt_long', 'o')}</button>
    <div class="text-center leading-none">
      <h1 class="font-headline-md text-headline-md tracking-tighter text-primary uppercase">Amavas</h1>
      ${state.code ? `<span class="font-label-mono text-[10px] text-text-muted tracking-[0.25em]">${esc(state.code)}</span>` : ''}
    </div>
    <button data-act="role" class="p-2 -mr-2 text-on-surface-variant active:scale-95 transition">${ms('visibility', 'o')}</button>
  </header>`;
}

const chip = (text, tone) => {
  const t = tone === 'evil' ? 'text-tertiary-container border-tertiary-container/25 bg-tertiary-container/10'
    : tone === 'mute' ? 'text-text-muted border-border-subtle bg-surface-container'
    : 'text-primary border-primary/20 bg-primary/10';
  return `<div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${t} font-label-caps text-label-caps uppercase tracking-widest">
    <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>${esc(text)}</div>`;
};

const bigBtn = (act, label, icon, tone, disabled) => {
  const t = tone === 'danger' ? 'bg-tertiary-container/10 border border-tertiary-container text-tertiary-container'
    : tone === 'ghost' ? 'bg-surface-container border border-border-subtle text-on-surface-variant'
    : 'bg-primary text-on-primary-fixed shimmer';
  return `<button ${disabled ? 'disabled' : ''} data-act="${act}"
    class="w-full h-14 rounded-xl flex items-center justify-center gap-2 font-label-caps text-label-caps
    uppercase tracking-widest transition active:scale-[.98] ${t} ${disabled ? 'opacity-40' : ''}">
    ${icon ? ms(icon) : ''}${esc(label)}</button>`;
};

function actionBar(inner) {
  return `<div class="fixed bottom-0 left-0 w-full z-40 px-gutter pt-4 pb-6
    bg-gradient-to-t from-background via-background/95 to-transparent">
    <div class="max-w-lg mx-auto flex flex-col gap-3">${inner}</div></div>`;
}

// player dossier row
function dossier(p, opts) {
  opts = opts || {};
  const dead = !p.alive;
  const sel = selected === p.id;
  const tags = [];
  if (dead) tags.push(`<span class="px-2 py-0.5 rounded-full bg-error-container/20 text-error border border-error/20 font-label-caps text-[9px] uppercase">Extinguished</span>`);
  else tags.push(`<span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-label-caps text-[9px] uppercase">Alive</span>`);
  if (dead && p.ghostVote) tags.push(`<span class="px-2 py-0.5 rounded-full bg-surface-container-high text-text-muted font-label-caps text-[9px] uppercase">Ghost vote</span>`);
  if (p.host) tags.push(`<span class="px-2 py-0.5 rounded-full bg-surface-container-high text-text-muted font-label-caps text-[9px] uppercase">Host</span>`);
  if (!p.connected) tags.push(`<span class="px-2 py-0.5 rounded-full bg-surface-container-high text-text-muted font-label-caps text-[9px] uppercase">Offline</span>`);
  const you = state.you && p.id === state.you.id;
  return `<div data-pick="${opts.pick ? p.id : ''}"
    class="dossier-card glass-panel rounded-xl p-3 flex items-center justify-between border border-border-subtle
    ${sel ? 'active' : ''} ${dead ? 'extinguished' : ''} ${opts.pick ? 'cursor-pointer' : ''}">
    <div class="flex items-center gap-3 min-w-0">
      <div class="shrink-0 w-12 h-12 rounded-full overflow-hidden ${dead ? 'grayscale' : ''}">${genericAvatar(p.name, { size: 48 })}</div>
      <div class="min-w-0">
        <h3 class="font-headline-md text-[19px] leading-tight text-text-high-contrast truncate ${dead ? 'line-through opacity-60' : ''}">
          ${esc(p.name)}${you ? '<span class="text-primary text-[13px] font-label-mono"> · you</span>' : ''}</h3>
        <div class="flex flex-wrap gap-1.5 mt-1">${tags.join('')}</div>
      </div>
    </div>
    ${opts.pick ? `<div class="pl-2 ${sel ? 'text-primary' : 'text-outline-variant'}">${ms(sel ? 'radio_button_checked' : 'radio_button_unchecked', sel ? '' : 'o')}</div>` : ''}
  </div>`;
}

// ---------------------------------------------------------------- screens
function joinScreen() {
  return `<main class="min-h-dvh flex flex-col items-center justify-center px-gutter text-center gap-6 py-10">
    <div class="w-24 h-24 rounded-full overflow-hidden pulse-ring">${portraitSVG('Rakshasa', { size: 96 })}</div>
    <div>
      <h1 class="font-display-lg text-display-lg text-primary tracking-tighter">AMAVAS</h1>
      <p class="font-label-caps text-label-caps text-text-muted uppercase tracking-[0.3em] mt-1">The moonless night</p>
    </div>
    <p class="font-body-md text-body-md text-on-surface-variant max-w-xs">
      A Rakshasa has moved into your society. 5–20 players, one room, one liar you cannot see.</p>
    <div class="w-full max-w-sm flex flex-col gap-3">
      <input id="nameInput" maxlength="16" autocomplete="off" placeholder="Your name" value="${esc(lastName)}"
        class="w-full h-14 px-4 rounded-xl bg-surface-container border border-border-subtle text-on-surface
        font-body-lg text-body-lg placeholder:text-text-muted focus:border-primary/50 focus:ring-0"/>
      ${bigBtn('create', 'Start a new game', 'add_circle')}
      <div class="flex items-center gap-3 my-1">
        <span class="h-px flex-1 bg-border-subtle"></span>
        <span class="font-label-caps text-label-caps text-text-muted uppercase">or join one</span>
        <span class="h-px flex-1 bg-border-subtle"></span>
      </div>
      <input id="codeInput" maxlength="4" autocomplete="off" placeholder="CODE"
        class="w-full h-14 px-4 rounded-xl bg-surface-container border border-border-subtle text-on-surface
        font-label-mono text-[26px] tracking-[0.4em] text-center uppercase placeholder:text-text-muted
        placeholder:tracking-[0.4em] focus:border-primary/50 focus:ring-0"/>
      ${bigBtn('join', 'Join that game', 'login', 'ghost')}
      ${joinError ? `<p class="text-tertiary-container font-label-mono text-label-mono mt-1">${esc(joinError)}</p>` : ''}
    </div>
  </main>`;
}

const table = () => state.players.filter(p => !p.storyteller);

function lobbyScreen() {
  const n = state.seatedCount;
  const ok = n >= state.minPlayers && n <= state.maxPlayers;
  const you = state.you;
  const st = state.storyteller;
  return `${topBar()}
  <main class="pt-24 pb-safe-bottom px-gutter max-w-lg mx-auto fade-up">
    <header class="text-center mb-6">
      ${chip('Gathering', 'mute')}
      <h2 class="font-headline-lg text-headline-lg text-text-high-contrast mt-4">The Society</h2>
      <p class="font-body-md text-body-md text-on-surface-variant mt-1">
        <span class="text-primary font-semibold">${n}</span> of ${state.minPlayers}–${state.maxPlayers} residents present.</p>
    </header>
    <div class="glass-panel rounded-xl border border-primary/30 p-5 mb-6 text-center">
      <p class="font-label-caps text-label-caps text-text-muted uppercase">Room code</p>
      <p class="font-label-mono text-primary mt-1" style="font-size:44px;letter-spacing:.3em;line-height:1.1">${esc(state.code || '')}</p>
      <p class="font-body-md text-[14px] text-on-surface-variant mt-2">
        Everyone else opens <b class="text-on-surface">${esc(location.host)}</b> and enters this code.</p>
      <button data-act="copyLink" class="mt-3 font-label-caps text-label-caps text-primary uppercase">
        ${ms('link', 'o')} Copy invite link</button>
    </div>
    ${scriptPicker()}
    <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3 flex justify-between">
      <span>How it's run</span><span>${you.host ? 'Host chooses' : (st ? 'Storyteller' : 'Host mode')}</span></h3>
    <div class="flex flex-col gap-stack-gap mb-6">
      <div ${you.host && st ? 'data-mode="host"' : ''}
        class="dossier-card glass-panel rounded-xl border p-4 ${!st ? 'active border-primary/40' : 'border-border-subtle opacity-60'}
        ${you.host && st ? 'cursor-pointer' : ''}">
        <div class="flex items-center justify-between gap-2">
          <h4 class="font-headline-md text-[20px] text-text-high-contrast">Host mode</h4>
          <span class="px-2 py-0.5 rounded-full font-label-caps text-[9px] uppercase border
            ${!st ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-container-high text-text-muted border-border-subtle'}">
            Everyone plays</span>
        </div>
        <p class="font-body-md text-[15px] text-on-surface-variant mt-2">
          Nobody sits out and nobody sees anyone's secrets — not even you. You only get the
          pacing controls: start the night, end the day when the room feels done.</p>
        <p class="font-body-md text-[14px] text-text-muted mt-2">
          The app storytells invisibly: it watches the balance and only leans on a call when
          the game looks like it's about to end too soon. You'll find out what it did afterwards.</p>
        ${you.host && !st ? `<button data-act="toggleDirector"
          class="mt-3 w-full flex items-center justify-between px-3 py-2.5 rounded-xl border
          ${state.director ? 'bg-primary/10 border-primary/25 text-primary' : 'bg-surface-container border-border-subtle text-text-muted'}">
          <span class="font-label-caps text-label-caps uppercase">Unseen storyteller</span>
          <span class="font-label-mono text-label-mono">${state.director ? 'ON' : 'OFF'}</span>
        </button>` : ''}
      </div>
      <div ${you.host && !st ? 'data-mode="storyteller"' : ''}
        class="dossier-card glass-panel rounded-xl border p-4 ${st ? 'active border-primary/40' : 'border-border-subtle opacity-60'}
        ${you.host && !st ? 'cursor-pointer' : ''}">
        <div class="flex items-center justify-between gap-2">
          <h4 class="font-headline-md text-[20px] text-text-high-contrast">Storyteller mode</h4>
          <span class="px-2 py-0.5 rounded-full font-label-caps text-[9px] uppercase border
            ${st ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-container-high text-text-muted border-border-subtle'}">
            One sits out</span>
        </div>
        <p class="font-body-md text-[15px] text-on-surface-variant mt-2">
          ${st ? `<b class="text-primary">${esc(st.name)}</b> runs it by hand` : 'You run it by hand'} —
          sees every role, decides what poisoned players are told, whispers clues, and can twist
          the game: swap someone's role, or offer them the chance to switch sides.</p>
      </div>
    </div>
    <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3 flex justify-between">
      <span>Roster</span><span>${n} playing</span></h3>
    <div class="flex flex-col gap-stack-gap">${table().map(p => dossier(p)).join('')}</div>
  </main>
  ${actionBar(you.host
    ? bigBtn('start', ok ? 'Begin the first night'
        : (n < state.minPlayers ? `Need ${state.minPlayers - n} more player(s)` : 'Too many players'),
        'local_fire_department', 'primary', !ok)
    : bigBtn('', 'Waiting for the host', 'hourglass_empty', 'ghost', true))}`;
}

// ---------------------------------------------------------------- storyteller
function grimoireCard(g) {
  const evil = g.team === 'evil';
  const tags = [];
  if (!g.alive) tags.push(['Dead', 'error']);
  if (g.poisoned) tags.push(['Poisoned', 'evil']);
  if (g.protectedTonight) tags.push(['Warded', 'primary']);
  if (g.believes) tags.push([`Thinks ${g.believes}`, 'mute']);
  if (!g.alive && g.ghostVote) tags.push(['Ghost vote', 'mute']);
  if (state.phase === 'night' && g.needsToAct) tags.push([g.acted ? `Acted → ${g.target || '—'}` : 'Still acting', g.acted ? 'primary' : 'evil']);
  if (!g.connected) tags.push(['Offline', 'mute']);
  const tone = t => t === 'evil' ? 'bg-tertiary-container/10 text-tertiary-container border-tertiary-container/25'
    : t === 'error' ? 'bg-error-container/20 text-error border-error/25'
    : t === 'primary' ? 'bg-primary/10 text-primary border-primary/25'
    : 'bg-surface-container-high text-text-muted border-border-subtle';
  return `<div class="glass-panel rounded-xl border ${evil ? 'border-tertiary-container/35' : 'border-border-subtle'}
      p-3 flex items-start gap-3 ${g.alive ? '' : 'opacity-60'}">
    <div class="w-12 h-12 rounded-full overflow-hidden shrink-0 ${g.alive ? '' : 'grayscale'}">${portraitSVG(g.role, { size: 48 })}</div>
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="font-headline-md text-[18px] text-text-high-contrast truncate ${g.alive ? '' : 'line-through'}">${esc(g.name)}</span>
        <span class="font-label-mono text-[11px] ${evil ? 'text-tertiary-container' : 'text-primary'} shrink-0">${esc(g.role || '—')}</span>
      </div>
      <div class="flex flex-wrap gap-1.5 mt-1.5">${tags.map(([t, k]) =>
        `<span class="px-2 py-0.5 rounded-full border font-label-caps text-[9px] uppercase ${tone(k)}">${esc(t)}</span>`).join('')}</div>
      <button data-msg="${g.id}" class="mt-2 font-label-caps text-label-caps text-primary uppercase flex items-center gap-1">
        ${ms('send', 'o')} Whisper</button>
    </div>
  </div>`;
}

function stScreen() {
  const g = state.grimoire || [];
  const evilAlive = g.filter(x => x.alive && x.team === 'evil').length;
  const goodAlive = g.filter(x => x.alive && x.team === 'good').length;
  const phaseLabel = state.phase === 'night' ? `Night ${state.dayNum + 1}`
    : state.phase === 'day' ? `Day ${state.dayNum}` : state.phase === 'over' ? 'Game over' : 'Lobby';
  const waiting = g.filter(x => x.needsToAct && !x.acted).length;
  return `${topBar()}
  <main class="pt-24 pb-safe-bottom px-gutter max-w-lg mx-auto fade-up">
    <header class="text-center mb-5">
      ${chip('Storyteller · ' + phaseLabel, 'primary')}
      <h2 class="font-headline-lg text-headline-lg text-text-high-contrast mt-4">The Grimoire</h2>
      <p class="font-body-md text-body-md text-on-surface-variant mt-2">
        You see everything. Balance the game, feed a clue, ruin a night.</p>
    </header>
    <div class="grid grid-cols-3 gap-2 mb-6">
      ${[['Good alive', goodAlive, 'primary'], ['Evil alive', evilAlive, 'evil'],
         [state.phase === 'night' ? 'Still acting' : 'On the block', state.phase === 'night' ? waiting : (state.onBlock ? 1 : 0), 'mute']]
        .map(([label, val, k]) => `<div class="glass-panel rounded-xl border border-border-subtle p-3 text-center">
          <div class="font-display-lg text-[30px] leading-none ${k === 'primary' ? 'text-primary' : k === 'evil' ? 'text-tertiary-container' : 'text-on-surface'}">${val}</div>
          <div class="font-label-caps text-[9px] uppercase text-text-muted mt-1">${esc(label)}</div>
        </div>`).join('')}
    </div>
    ${state.phase === 'day' && state.onBlock
      ? `<div class="glass-panel rounded-xl border border-tertiary-container/40 p-3 mb-5 text-center">
          <span class="font-label-caps text-label-caps text-tertiary-container uppercase">On the block</span>
          <p class="font-headline-md text-headline-md text-text-high-contrast">${esc(state.onBlock)} · ${state.onBlockVotes} votes</p></div>` : ''}
    <div class="flex flex-col gap-stack-gap">${g.map(grimoireCard).join('')}</div>
  </main>
  ${actionBar(
    state.phase === 'day' ? bigBtn('endDay', 'End the day', 'nights_stay', 'primary')
    : state.phase === 'over' ? bigBtn('newGame', 'Play again', 'restart_alt', 'primary')
    : bigBtn('', waiting ? `${waiting} still to act` : 'Resolving the night…', 'hourglass_empty', 'ghost', true))}`;
}

function offerOverlay() {
  const o = state.offer;
  return `<div class="fixed inset-0 z-[80] bg-background/97 backdrop-blur-xl overflow-y-auto scanlines">
    <div class="min-h-dvh flex flex-col justify-center px-gutter py-10 max-w-lg mx-auto text-center">
      <div class="w-24 h-24 rounded-full mx-auto mb-6 pulse-ring overflow-hidden">${portraitSVG('Rakshasa', { size: 96 })}</div>
      <span class="font-label-caps text-label-caps text-tertiary-container uppercase tracking-widest">For your eyes only</span>
      <h2 class="font-headline-lg text-headline-lg text-text-high-contrast mt-3">${esc(o.title)}</h2>
      <p class="font-body-lg text-body-lg text-on-surface-variant mt-4">${esc(o.body)}</p>
      <p class="font-label-mono text-label-mono text-text-muted mt-5">Nobody else sees this. Answer and it disappears.</p>
      <div class="flex flex-col gap-3 mt-8">
        ${bigBtn('takeOffer', 'Take it', 'handshake', 'danger')}
        ${bigBtn('refuseOffer', 'Refuse', 'block', 'ghost')}
      </div>
    </div>
  </div>`;
}

function decisionOverlay() {
  const d = state.decision;
  return `<div class="fixed inset-0 z-[70] bg-background/95 backdrop-blur-xl overflow-y-auto">
    <div class="min-h-dvh flex flex-col justify-center px-gutter py-10 max-w-lg mx-auto">
      <span class="font-label-caps text-label-caps text-primary uppercase tracking-widest text-center">Your call</span>
      <h2 class="font-headline-lg text-headline-lg text-text-high-contrast text-center mt-3">${esc(d.title)}</h2>
      ${d.detail ? `<p class="font-body-md text-body-md text-on-surface-variant text-center mt-3">${esc(d.detail)}</p>` : ''}
      <div class="flex flex-col gap-stack-gap mt-7">${d.options.map(o =>
        `<button data-decide="${esc(o.id)}"
          class="dossier-card glass-panel rounded-xl border border-border-subtle p-4 text-left active:scale-[.99]">
          <div class="font-headline-md text-[19px] text-text-high-contrast">${esc(o.label)}</div>
          ${o.hint ? `<div class="font-label-mono text-[11px] text-text-muted mt-1 uppercase">${esc(o.hint)}</div>` : ''}
        </button>`).join('')}</div>
      <div class="mt-5">${bigBtn('decideAuto', 'Let the app choose', 'casino', 'ghost')}</div>
    </div>
  </div>`;
}

function whisperOverlay() {
  const g = (state.grimoire || []).find(x => x.id === whisperTo);
  if (!g) return '';
  return `<div class="fixed inset-0 z-[70] bg-background/95 backdrop-blur-xl flex flex-col justify-end">
    <div data-act="closeWhisper" class="flex-1"></div>
    <div class="rounded-t-3xl glass-panel border-t border-border-subtle px-gutter pt-5 pb-8">
      <div class="w-10 h-1 rounded-full bg-border-subtle mx-auto mb-5"></div>
      <div class="flex items-center gap-3 mb-4">
        <div class="w-12 h-12 rounded-full overflow-hidden shrink-0">${portraitSVG(g.role, { size: 48 })}</div>
        <div>
          <h3 class="font-headline-md text-headline-md text-text-high-contrast leading-tight">Whisper to ${esc(g.name)}</h3>
          <p class="font-label-mono text-[11px] text-text-muted uppercase">${esc(g.role || '')}</p>
        </div>
      </div>
      <p class="font-body-md text-[14.5px] text-on-surface-variant mb-3">
        Goes straight to their secret intel. They will not know it came from you rather than their role.</p>
      <textarea id="whisperText" rows="3" maxlength="240" placeholder="You feel certain that Meera is not what she claims…"
        class="w-full p-3 rounded-xl bg-surface-container border border-border-subtle text-on-surface
        font-body-md text-body-md placeholder:text-text-muted focus:border-primary/50 focus:ring-0"></textarea>
      <div class="flex flex-col gap-2 mt-3">
        ${bigBtn('sendWhisper', 'Send it', 'send', 'primary')}
      </div>
      <h4 class="font-label-caps text-label-caps text-text-muted uppercase mt-6 mb-2">Twists</h4>
      <div class="grid grid-cols-2 gap-2">
        ${bigBtn('stOffer', 'Offer them a side switch', 'swap_horiz', 'danger')}
        ${bigBtn('stReroll', 'Give them a new role', 'autorenew', 'ghost')}
      </div>
      <h4 class="font-label-caps text-label-caps text-text-muted uppercase mt-6 mb-2">Heavier hands</h4>
      <p class="font-body-md text-[13.5px] text-text-muted mb-3">
        For when one side is running away with it. Nothing here is announced as yours.</p>
      <div class="grid grid-cols-2 gap-2">
        ${bigBtn('stPoison', g.poisoned ? 'Lift the poison' : 'Poison them', 'science', g.poisoned ? 'ghost' : 'danger')}
        ${g.alive ? bigBtn('stKill', 'Kill them', 'skull', 'danger') : bigBtn('stRevive', 'Bring back', 'favorite', 'ghost')}
        ${!g.alive && !g.ghostVote ? bigBtn('stGhost', 'Restore ghost vote', 'how_to_vote', 'ghost') : ''}
      </div>
      <div class="mt-3">${bigBtn('closeWhisper', 'Close', 'close', 'ghost')}</div>
    </div>
  </div>`;
}

function scriptPicker() {
  const list = state.scripts || [];
  const host = state.you.host;
  return `<h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3 flex justify-between">
      <span>Story mode</span><span>${host ? 'Host chooses' : esc(state.script.name)}</span></h3>
    <div class="flex flex-col gap-stack-gap mb-6">${list.map(sc => {
      const on = sc.id === state.scriptId;
      return `<div ${host ? `data-script="${sc.id}"` : ''}
        class="dossier-card glass-panel rounded-xl border p-4 ${on ? 'active border-primary/40' : 'border-border-subtle'}
        ${host ? 'cursor-pointer' : ''} ${!host && !on ? 'opacity-40' : ''}">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-full overflow-hidden shrink-0">${portraitSVG(sc.demon, { size: 44 })}</div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <h4 class="font-headline-md text-[20px] leading-tight text-text-high-contrast">${esc(sc.name)}</h4>
              <span class="shrink-0 px-2 py-0.5 rounded-full font-label-caps text-[9px] uppercase border
                ${on ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-container-high text-text-muted border-border-subtle'}">
                ${esc(sc.difficulty)}</span>
            </div>
            <p class="font-label-mono text-[11px] text-text-muted uppercase tracking-wider mt-0.5">${esc(sc.tag)}</p>
            <p class="font-body-md text-[15px] text-on-surface-variant mt-2">${esc(sc.blurb)}</p>
            <button data-roles="${sc.id}" class="mt-3 font-label-caps text-label-caps text-primary uppercase
              flex items-center gap-1">${ms('menu_book', 'o')} See the ${sc.roles.length} roles</button>
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
}

function rolesOverlay() {
  const sc = (state.scripts || []).find(s => s.id === sheetScript) || state.script;
  const roles = sc.roles || [];
  const group = (label, kind) => {
    const rs = roles.filter(r => r.kind === kind);
    if (!rs.length) return '';
    return `<h4 class="font-label-caps text-label-caps text-text-muted uppercase mt-6 mb-3">${label}</h4>
      <div class="flex flex-col gap-stack-gap">${rs.map(r => `
        <div class="glass-panel rounded-xl border border-border-subtle p-3 flex items-start gap-3">
          <div class="w-12 h-12 rounded-full overflow-hidden shrink-0">${portraitSVG(r.name, { size: 48 })}</div>
          <div class="min-w-0">
            <div class="font-headline-md text-[18px] leading-tight
              ${r.team === 'evil' ? 'text-tertiary-container' : 'text-primary'}">${esc(r.icon || '')} ${esc(r.name)}</div>
            <p class="font-body-md text-[14px] text-on-surface-variant mt-1">${esc(r.blurb)}</p>
          </div>
        </div>`).join('')}</div>`;
  };
  return `<div class="fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl overflow-y-auto">
    <header class="sticky top-0 h-16 px-margin-sm flex justify-between items-center bg-surface/90 backdrop-blur-xl border-b border-white/10">
      <h2 class="font-headline-md text-headline-md text-primary tracking-tighter truncate">${esc(sc.name)}</h2>
      <button data-act="closeRoles" class="p-2 text-on-surface-variant shrink-0">${ms('close', 'o')}</button>
    </header>
    <div class="px-gutter pb-10 max-w-lg mx-auto">
      <p class="font-body-md text-body-md text-on-surface-variant mt-5">${esc(sc.blurb)}</p>
      ${group('Residents', 'villager')}${group('Outsiders', 'outsider')}
      ${group('Minions', 'minion')}${group('The demon', 'demon')}
    </div>
  </div>`;
}

function nightScreen() {
  const you = state.you;
  if (state.needsAction && state.actionPrompt) {
    const pr = state.actionPrompt;
    const targets = table().filter(p => pr.targets.some(t => t.id === p.id));
    return `${topBar()}
    <main class="pt-24 pb-safe-bottom px-gutter max-w-lg mx-auto fade-up">
      <header class="text-center mb-6">
        ${chip('Night ' + (state.dayNum + 1), 'primary')}
        <h2 class="font-headline-lg text-headline-lg text-text-high-contrast mt-4">${esc(pr.verb)} someone</h2>
        <p class="font-body-md text-body-md text-on-surface-variant mt-2">
          You are <span class="text-primary font-semibold">${esc(you.role)}</span>. ${esc(pr.text)}</p>
      </header>
      <div class="flex flex-col gap-stack-gap">${targets.map(p => dossier(p, { pick: true })).join('')}</div>
    </main>
    ${actionBar(bigBtn('confirmNight', selected ? `${pr.verb} ${nameOf(selected)}` : 'Select a target',
      'ads_click', 'primary', !selected))}`;
  }
  return `${topBar()}
  <main class="min-h-dvh flex flex-col items-center justify-center pt-20 pb-safe-bottom px-gutter max-w-lg mx-auto text-center fade-up">
    <div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(152,203,255,.08),transparent_65%)]"></div>
    ${chip('Night ' + (state.dayNum + 1), 'primary')}
    <h2 class="font-display-lg text-display-lg text-text-high-contrast mt-6 leading-tight">The Society<br/>Sleeps…</h2>
    <p class="font-body-lg text-body-lg text-on-surface-variant mt-3 max-w-[300px]">
      Darkness obscures the truth. No talking — phones down unless it is your turn.</p>
    <div class="relative my-10">
      <div class="absolute inset-0 rounded-full border border-primary/20 animate-[spin_12s_linear_infinite]"></div>
      <div class="absolute inset-2 rounded-full border border-dashed border-primary/30 animate-[spin_18s_linear_infinite_reverse]"></div>
      <div class="w-32 h-32 rounded-full glass-panel border border-border-subtle flex flex-col items-center justify-center pulse-ring">
        ${ms('bedtime')}
        <div class="font-label-mono text-label-mono text-text-high-contrast mt-2">${state.waitingOn} acting</div>
      </div>
    </div>
    <div class="w-full glass-panel rounded-xl border border-border-subtle p-4">
      <div class="flex justify-between items-center mb-3">
        <span class="font-label-caps text-label-caps text-text-muted uppercase">Current status</span>
        <span class="font-label-mono text-label-mono text-tertiary-container">${state.waitingOn} still acting</span>
      </div>
      <div class="flex flex-col gap-2">${Array.from({ length: Math.max(1, state.waitingOn) }, (_, i) =>
        `<div class="h-10 rounded-lg bg-surface-container border border-border-subtle flex items-center px-3 shimmer">
          <div class="w-6 h-6 rounded bg-primary/20 mr-3"></div>
          <div class="h-2 rounded bg-on-surface-variant/25" style="width:${30 + (i * 17) % 40}%"></div></div>`).join('')}</div>
    </div>
  </main>
  ${actionBar(bigBtn('', 'Waiting for resolution', 'lock', 'ghost', true))}`;
}

function voteScreen() {
  const n = state.nomination, you = state.you;
  const nominee = state.players.find(p => p.name === n.nominee) || { name: n.nominee };
  const pending = table().filter(p => (p.alive || p.ghostVote));
  const yes = state.onBlockVotes;
  return `${topBar()}
  <main class="pt-24 pb-[190px] px-gutter max-w-lg mx-auto fade-up">
    <section class="flex flex-col items-center text-center mb-6">
      <span class="font-label-caps text-label-caps text-tertiary-container uppercase tracking-widest animate-pulse">Society meeting</span>
      <h2 class="font-display-lg text-display-lg text-text-high-contrast mt-2">${esc(n.nominee)}</h2>
      <p class="font-body-md text-body-md text-text-muted mt-1">Accused by ${esc(n.nominator)}. Fate hangs in balance.</p>
      <div class="relative mt-5 w-32 h-32 rounded-full p-1 border-2 border-border-subtle">
        <div class="w-full h-full rounded-full overflow-hidden grayscale opacity-90">${genericAvatar(nominee.name, { size: 120 })}</div>
        <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full
          bg-surface-container-high border border-border-subtle shadow-lg">
          <span class="w-2 h-2 rounded-full bg-tertiary-container animate-pulse"></span>
          <span class="font-label-caps text-label-caps text-on-surface uppercase">On trial</span></div>
      </div>
    </section>
    <section class="glass-panel rounded-xl border border-border-subtle p-margin-sm mb-6 relative">
      <span class="absolute top-2 right-3 font-label-mono text-[9px] text-border-subtle">SYS.VOTE.TRK</span>
      <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3">Live consensus</h3>
      <div class="flex justify-between items-end mb-2">
        <div><div class="font-display-lg text-display-lg text-tertiary-container leading-none">${n.votesCast}</div>
          <div class="font-label-caps text-label-caps text-tertiary-container/70 uppercase">Votes in</div></div>
        <div class="text-right"><div class="font-display-lg text-display-lg text-primary leading-none">${n.votersTotal - n.votesCast}</div>
          <div class="font-label-caps text-label-caps text-primary/70 uppercase">Undecided</div></div>
      </div>
      <div class="w-full h-3 rounded-full overflow-hidden flex bg-surface-container-lowest shadow-inner">
        <div class="h-full bg-tertiary-container stripes" style="width:${(n.votesCast / n.votersTotal) * 100}%"></div>
      </div>
      <p class="font-label-mono text-label-mono text-text-muted mt-3">
        Current block: ${state.onBlock ? esc(state.onBlock) + ' (' + yes + ')' : 'nobody'}</p>
    </section>
    <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3 flex justify-between">
      <span>Awaiting decision</span>${ms('hourglass_empty', 'o')}</h3>
    <div class="flex flex-col gap-stack-gap">${pending.map(p => dossier(p)).join('')}</div>
  </main>
  ${actionBar(
    n.youEligible && !n.youVoted
      ? `<div class="grid grid-cols-2 gap-3">
          ${bigBtn('voteYes', 'Cast out', 'gavel', 'danger')}
          ${bigBtn('voteNo', 'Spare', 'health_and_safety', 'primary')}</div>`
      : bigBtn('', n.youEligible ? 'Your vote is in' : 'You cannot vote', 'check', 'ghost', true)
    + (you.host ? bigBtn('closeNom', 'Host: close vote now', 'timer_off', 'ghost') : ''))}`;
}

function dayScreen() {
  const you = state.you;
  if (state.nomination) return voteScreen();
  const ghost = !you.alive;
  return `${topBar()}
  <main class="pt-24 pb-safe-bottom px-gutter max-w-lg mx-auto fade-up">
    ${ghost ? ghostHero() : `<header class="text-center mb-6">
      ${chip('Day ' + state.dayNum, 'mute')}
      <h2 class="font-headline-lg text-headline-lg text-text-high-contrast mt-4">Society Meeting</h2>
      <p class="font-body-md text-body-md text-on-surface-variant mt-2">
        Talk it out loud, face to face. Then accuse and vote here.</p>
    </header>`}
    ${state.onBlock ? `<div class="glass-panel rounded-xl border border-tertiary-container/40 p-4 mb-6 text-center">
        <p class="font-label-caps text-label-caps text-tertiary-container uppercase">On the block</p>
        <p class="font-headline-md text-headline-md text-text-high-contrast mt-1">${esc(state.onBlock)}</p>
        <p class="font-label-mono text-label-mono text-text-muted mt-1">${state.onBlockVotes} votes — dies at dusk unless beaten</p></div>`
      : `<div class="glass-panel rounded-xl border border-border-subtle p-4 mb-6 text-center">
        <p class="font-label-mono text-label-mono text-text-muted">Nobody is on the block.</p></div>`}
    <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3 flex justify-between">
      <span>The society</span><span>${table().filter(p => p.alive).length} alive</span></h3>
    <div class="flex flex-col gap-stack-gap">${table().map(p => dossier(p)).join('')}</div>
    ${state.storyteller ? `<p class="font-label-mono text-label-mono text-text-muted text-center mt-4">
      ${esc(state.storyteller.name)} is storytelling</p>` : ''}
  </main>
  ${actionBar(
    (state.canNominate ? bigBtn('openAccuse', 'Accuse someone', 'gavel', 'danger') : '')
    + (you.canShoot ? bigBtn('openStrike', 'Slayer: your one strike', 'swords', 'danger') : '')
    + (you.host ? bigBtn('endDay', 'Host: end the day', 'nights_stay', 'primary') : '')
    + (!state.canNominate && !you.host && !you.canShoot
      ? bigBtn('', ghost ? 'Ghosts may not accuse' : 'You have accused today', 'block', 'ghost', true) : ''))}`;
}

function ghostHero() {
  const you = state.you;
  return `<section class="flex flex-col items-center text-center mb-6">
    <div class="w-20 h-20 rounded-full bg-surface-container-high border border-border-subtle flex items-center
      justify-center mb-4 opacity-70"><span class="ms" style="font-size:36px">skull</span></div>
    <h2 class="font-display-lg text-display-lg text-text-high-contrast leading-tight">YOU ARE<br/>A GHOST</h2>
    <p class="font-body-md text-body-md text-on-surface-variant max-w-xs mt-3">
      Your mortal coil has been severed. You may still talk — and haunt the vote.</p>
    <div class="w-full glass-panel rounded-3xl border border-border-subtle p-5 mt-6 flex items-center justify-between">
      <div class="text-left">
        <p class="font-label-caps text-label-caps text-primary uppercase">Post-mortem influence</p>
        <p class="font-headline-md text-headline-md text-on-surface mt-1">
          ${you.ghostVote ? '1 Ghost Vote Available' : 'Ghost vote spent'}</p>
      </div>
      <div class="w-12 h-12 rounded-full bg-surface-container-high border border-primary/20 text-primary
        flex items-center justify-center shrink-0">${ms('how_to_vote')}</div>
    </div>
  </section>`;
}

function overScreen() {
  const good = state.winner === 'good';
  const tone = good ? 'text-primary' : 'text-tertiary-container';
  const rows = (state.reveal || []).map((r, i) => {
    const evil = r.team === 'evil';
    return `<div class="glass-panel rounded-xl border border-border-subtle p-4 ${r.alive ? '' : 'opacity-75'}">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-full overflow-hidden shrink-0 ${r.alive ? '' : 'grayscale'}">
          ${portraitSVG(r.role, { size: 56 })}</div>
        <div class="min-w-0 flex-1">
          <div class="flex justify-between items-start gap-2">
            <div class="font-body-lg text-body-lg font-semibold text-text-high-contrast truncate
              ${r.alive ? '' : 'line-through text-on-surface-variant'}">${esc(r.name)}</div>
            <div class="font-label-mono text-[11px] text-text-muted shrink-0">ID:${String(i + 1).padStart(3, '0')}</div>
          </div>
          <div class="font-label-mono text-label-mono ${evil ? 'text-tertiary-container' : 'text-primary'} uppercase">
            ${esc(r.icon || '')} ${esc(r.role)}</div>
          ${r.believed ? `<div class="font-label-mono text-[11px] text-text-muted mt-0.5">believed they were ${esc(r.believed)}</div>` : ''}
        </div>
      </div>
      <div class="mt-3 flex justify-between items-center">
        <span class="px-3 py-1 rounded-full font-label-caps text-label-caps uppercase
          ${r.alive ? 'bg-primary/10 text-primary' : 'bg-error-container/20 text-error'}">
          ${r.alive ? 'Survived' : 'Eliminated'}</span>
        <span class="font-label-caps text-label-caps text-text-muted uppercase">${esc(r.kind)}</span>
      </div>
    </div>`;
  }).join('');
  return `${topBar()}
  <main class="pt-24 pb-safe-bottom px-gutter max-w-lg mx-auto fade-up relative">
    <div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(152,203,255,.1),transparent_60%)]"></div>
    <header class="text-center py-8">
      <div class="inline-block px-4 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary
        font-label-caps text-label-caps uppercase mb-4">Protocol terminated</div>
      <h1 class="font-display-lg text-display-lg ${tone} tracking-tighter shimmer inline-block px-2">
        ${good ? 'GOOD WINS' : 'EVIL WINS'}</h1>
      <p class="font-body-md text-body-md text-on-surface-variant mt-3">${esc(state.winReason)}</p>
    </header>
    ${(state.directorLog || []).length ? `<section class="mb-8">
      <h2 class="font-label-caps text-label-caps text-text-muted uppercase mb-3 flex items-center gap-2">
        ${ms('visibility_off', 'o')} What the night decided</h2>
      <div class="glass-panel rounded-xl border border-border-subtle p-4">
        <p class="font-body-md text-[14px] text-text-muted mb-3">
          The game was quietly steering while you played. It only stepped in when this looked
          like ending too early.</p>
        <div class="flex flex-col gap-2">${state.directorLog.map(d =>
          `<div class="flex gap-3">
            <span class="font-label-mono text-[11px] text-primary shrink-0 pt-0.5">N${d.day + 1}</span>
            <span class="font-body-md text-[14.5px] text-on-surface-variant">${esc(d.text)}</span>
          </div>`).join('')}</div>
      </div>
    </section>` : ''}
    <h2 class="font-label-caps text-label-caps text-text-muted uppercase mb-3 flex items-center gap-2">
      ${ms('group', 'o')} Final dossier</h2>
    <div class="flex flex-col gap-stack-gap">${rows}</div>
  </main>
  ${actionBar(state.you.host ? bigBtn('newGame', 'Play again', 'restart_alt', 'primary')
    : bigBtn('', 'Waiting for host', 'hourglass_empty', 'ghost', true))}`;
}

// ---------------------------------------------------------------- overlays
function roleOverlay() {
  const you = state.you;
  if (!you.role) return '';
  const evil = you.team === 'evil';
  const tone = evil ? 'tertiary-container' : 'primary';
  return `<div class="fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl flex flex-col px-gutter pt-20 pb-8">
    <button data-act="closeRole" class="absolute top-5 right-5 p-2 text-on-surface-variant">${ms('close', 'o')}</button>
    <div class="text-center mb-6">
      <h2 class="font-headline-lg text-headline-lg text-text-high-contrast">Your Role</h2>
      <p class="font-body-md text-body-md text-on-surface-variant mt-1">Hold the seal to reveal. Nobody should see this.</p>
    </div>
    <div id="revealArea" class="relative w-full max-w-sm mx-auto flex-1 max-h-[560px] rounded-3xl overflow-hidden
      border border-border-subtle bg-surface-container-low scanlines">
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-4">
        <div class="w-36 h-36 rounded-full overflow-hidden">${portraitSVG(you.role, { size: 144 })}</div>
        <h3 class="font-headline-lg text-headline-lg text-${tone} tracking-tight">${esc(you.role)}</h3>
        <div class="px-3 py-1 rounded-full bg-${tone}/10 border border-${tone}/20">
          <span class="font-label-caps text-label-caps text-${tone} uppercase">${evil ? 'Evil' : 'Good'}</span></div>
        <p class="font-body-md text-body-md text-on-surface-variant">${esc(you.blurb || '')}</p>
      </div>
      <div class="veil absolute inset-0 z-10 flex flex-col items-center justify-center"
        style="background:radial-gradient(circle at center, rgba(30,31,38,.85) 0%, rgba(17,19,25,1) 100%)">
        <div class="relative w-24 h-24 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full border-2 border-primary/20 pulse-ring"></div>
          <div class="absolute inset-0 rounded-full border border-primary/40 border-t-transparent animate-[spin_4s_linear_infinite]"></div>
          <button id="peekBtn" class="w-16 h-16 rounded-full bg-surface-container border border-border-subtle
            flex items-center justify-center touch-none">${ms('fingerprint', 'o')}</button>
        </div>
        <p class="font-label-mono text-label-mono text-on-surface-variant mt-5 select-none">PRESS &amp; HOLD</p>
      </div>
    </div>
  </div>`;
}

function drawerOverlay() {
  const you = state.you;
  const inbox = (you.inbox || []).slice().reverse();
  const log = (state.log || []).slice().reverse();
  return `<div class="fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl overflow-y-auto">
    <header class="sticky top-0 h-16 px-margin-sm flex justify-between items-center bg-surface/90 backdrop-blur-xl border-b border-white/10">
      <h2 class="font-headline-md text-headline-md text-primary tracking-tighter">Records</h2>
      <button data-act="closeDrawer" class="p-2 text-on-surface-variant">${ms('close', 'o')}</button>
    </header>
    <div class="px-gutter py-6 max-w-lg mx-auto flex flex-col gap-8">
      <section>
        <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3">This room</h3>
        <div class="glass-panel rounded-xl border border-border-subtle p-4 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-label-mono text-headline-md text-primary tracking-[0.25em]">${esc(state.code || '')}</p>
            <p class="font-body-md text-[13.5px] text-text-muted mt-0.5 truncate">${esc(state.script.name)} · ${state.seatedCount} playing</p>
          </div>
          <button data-act="leave" class="px-4 py-2.5 rounded-xl border border-tertiary-container/40
            text-tertiary-container font-label-caps text-label-caps uppercase shrink-0">Leave</button>
        </div>
      </section>
      <section>
        <h3 class="font-label-caps text-label-caps text-primary uppercase mb-3 flex items-center gap-2">
          ${ms('lock', 'o')} Your secret intel</h3>
        ${inbox.length ? `<div class="flex flex-col gap-2">${inbox.map(m =>
          `<div class="glass-panel rounded-xl border-l-2 border-primary p-3">
            <div class="font-label-mono text-[11px] text-text-muted uppercase">Night ${m.day + 1}</div>
            <div class="font-body-md text-body-md text-on-surface mt-1">${esc(m.text)}</div></div>`).join('')}</div>`
          : `<p class="font-label-mono text-label-mono text-text-muted">Nothing yet. Your role may have no night intel.</p>`}
      </section>
      <section>
        <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3 flex items-center gap-2">
          ${ms('receipt_long', 'o')} Society record</h3>
        <div class="flex flex-col gap-2">${log.map((m, i) =>
          `<div class="rounded-xl border-l-2 ${i === 0 ? 'border-primary bg-surface-container' : 'border-border-subtle'} p-3">
            <div class="font-body-md text-[15px] ${i === 0 ? 'text-on-surface' : 'text-on-surface-variant'}">${esc(m.text)}</div>
          </div>`).join('')}</div>
      </section>
    </div>
  </div>`;
}

function sheetOverlay() {
  const isStrike = sheet === 'strike';
  const list = isStrike
    ? table().filter(p => p.alive && p.id !== state.you.id)
    : table().filter(p => (state.nominees || []).some(t => t.id === p.id) && p.id !== state.you.id);
  return `<div class="fixed inset-0 z-[60] bg-background/90 backdrop-blur-xl flex flex-col justify-end">
    <div data-act="closeSheet" class="flex-1"></div>
    <div class="rounded-t-3xl glass-panel border-t border-border-subtle px-gutter pt-5 pb-8 max-h-[80dvh] overflow-y-auto">
      <div class="w-10 h-1 rounded-full bg-border-subtle mx-auto mb-5"></div>
      <h3 class="font-headline-md text-headline-md text-text-high-contrast mb-1">
        ${isStrike ? 'Strike a resident' : 'Accuse a resident'}</h3>
      <p class="font-body-md text-body-md text-on-surface-variant mb-5">
        ${isStrike ? 'One shot, whole game. If they are the Rakshasa, it dies — publicly.'
          : 'Half the living must agree to put them on the block.'}</p>
      <div class="flex flex-col gap-stack-gap">${list.length ? list.map(p =>
        `<button data-${isStrike ? 'strike' : 'accuse'}="${p.id}"
          class="dossier-card glass-panel rounded-xl border border-border-subtle p-3 flex items-center gap-3 text-left active:scale-[.99]">
          <div class="w-11 h-11 rounded-full overflow-hidden shrink-0">${genericAvatar(p.name, { size: 44 })}</div>
          <span class="font-headline-md text-[19px] text-text-high-contrast flex-1 truncate">${esc(p.name)}</span>
          ${ms('chevron_right', 'o')}</button>`).join('')
        : `<p class="font-label-mono text-label-mono text-text-muted">No valid targets.</p>`}</div>
      <div class="mt-5">${bigBtn('closeSheet', 'Cancel', 'close', 'ghost')}</div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- render
const nameOf = id => { const p = state.players.find(x => x.id === id); return p ? p.name : ''; };

function render() {
  if (!state || !state.you) {
    roleOpen = drawer = false; sheet = null;
    app().innerHTML = joinScreen(); overlay().innerHTML = ''; wire(); return;
  }
  const s = state.phase;
  const st = state.you.storyteller;
  app().innerHTML = s === 'lobby' ? lobbyScreen()
    : st ? stScreen()
    : s === 'night' ? nightScreen()
    : s === 'day' ? dayScreen()
    : s === 'over' ? overScreen() : '';
  overlay().innerHTML = state.offer ? offerOverlay()
    : state.decision ? decisionOverlay()
    : whisperTo ? whisperOverlay()
    : sheetScript ? rolesOverlay()
    : roleOpen ? roleOverlay() : drawer ? drawerOverlay() : sheet ? sheetOverlay() : '';
  wire();
}

function wire() {
  const peek = document.getElementById('peekBtn');
  if (peek) {
    const area = document.getElementById('revealArea');
    const on = e => { e.preventDefault(); area.classList.add('revealing'); };
    const off = e => { e.preventDefault(); area.classList.remove('revealing'); };
    peek.addEventListener('touchstart', on, { passive: false });
    peek.addEventListener('touchend', off); peek.addEventListener('touchcancel', off);
    peek.addEventListener('mousedown', on); peek.addEventListener('mouseup', off);
    peek.addEventListener('mouseleave', off);
    peek.addEventListener('contextmenu', e => e.preventDefault());
  }
  const input = document.getElementById('nameInput');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(false); });
  const codeEl = document.getElementById('codeInput');
  if (codeEl) {
    // an invite link like /?room=ABCD prefills the code
    const fromLink = new URLSearchParams(location.search).get('room');
    if (fromLink && !codeEl.value) codeEl.value = fromLink.toUpperCase().slice(0, 4);
    codeEl.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(false); });
  }
}

function doJoin(create) {
  const el = document.getElementById('nameInput');
  const name = el && el.value.trim();
  if (!name) { joinError = 'Enter your name first.'; render(); return; }
  lastName = name; localStorage.setItem('nf_name', name);
  const codeEl = document.getElementById('codeInput');
  const code = codeEl ? codeEl.value.trim().toUpperCase() : '';
  if (!create && !code) { joinError = 'Enter a room code, or start a new game.'; render(); return; }
  joinError = '';
  send(create ? { type: 'join', name, create: true } : { type: 'join', name, code });
}

document.addEventListener('click', e => {
  const pick = e.target.closest('[data-pick]');
  if (pick && pick.dataset.pick) { selected = selected === pick.dataset.pick ? null : pick.dataset.pick; render(); return; }
  const acc = e.target.closest('[data-accuse]');
  if (acc) { send({ type: 'nominate', target: acc.dataset.accuse }); sheet = null; render(); return; }
  const str = e.target.closest('[data-strike]');
  if (str) { send({ type: 'shoot', target: str.dataset.strike }); sheet = null; render(); return; }
  const dec = e.target.closest('[data-decide]');
  if (dec) { send({ type: 'decision', option: dec.dataset.decide }); return; }
  const msgBtn = e.target.closest('[data-msg]');
  if (msgBtn) { whisperTo = msgBtn.dataset.msg; render(); return; }
  const rolesBtn = e.target.closest('[data-roles]');
  if (rolesBtn) { sheetScript = rolesBtn.dataset.roles; render(); return; }
  const sc = e.target.closest('[data-script]');
  if (sc) { send({ type: 'setScript', id: sc.dataset.script }); return; }
  const md = e.target.closest('[data-mode]');
  if (md) { send({ type: 'setStoryteller', on: md.dataset.mode === 'storyteller' }); return; }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const a = btn.dataset.act;
  if (a === 'join') doJoin(false);
  else if (a === 'create') doJoin(true);
  else if (a === 'leave') {
    if (confirm('Leave this game and go back?')) send({ type: 'leave' });
  }
  else if (a === 'start') send({ type: 'start' });
  else if (a === 'confirmNight' && selected) { send({ type: 'nightAction', target: selected }); selected = null; }
  else if (a === 'voteYes') send({ type: 'vote', yes: true });
  else if (a === 'voteNo') send({ type: 'vote', yes: false });
  else if (a === 'closeNom') send({ type: 'closeNomination' });
  else if (a === 'endDay') send({ type: 'endDay' });
  else if (a === 'newGame') send({ type: 'newGame' });
  else if (a === 'openAccuse') { sheet = 'accuse'; render(); }
  else if (a === 'openStrike') { sheet = 'strike'; render(); }
  else if (a === 'closeSheet') { sheet = null; render(); }
  else if (a === 'role') { roleOpen = true; drawer = false; render(); }
  else if (a === 'closeRole') { roleOpen = false; render(); }
  else if (a === 'drawer') { drawer = true; roleOpen = false; render(); }
  else if (a === 'closeDrawer') { drawer = false; render(); }
  else if (a === 'closeRoles') { sheetScript = null; render(); }
  else if (a === 'copyLink') {
    const url = location.origin + '/?room=' + encodeURIComponent(state.code || '');
    const done = () => { btn.textContent = 'Copied'; setTimeout(render, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Copy this link:', url));
    else prompt('Copy this link:', url);
  }
  else if (a === 'toggleDirector') send({ type: 'setDirector', on: !state.director });
  else if (a === 'takeOffer') send({ type: 'offer', accept: true });
  else if (a === 'refuseOffer') send({ type: 'offer', accept: false });
  else if (a === 'toggleST') send({ type: 'setStoryteller', on: !state.storyteller });
  else if (a === 'decideAuto') send({ type: 'decision', option: '__auto' });
  else if (a === 'closeWhisper') { whisperTo = null; render(); }
  else if (a === 'stOffer') { send({ type: 'stTwist', target: whisperTo, action: 'offer' }); whisperTo = null; render(); }
  else if (a === 'stReroll') {
    const sc = state.script;
    const g = (state.grimoire || []).find(x => x.id === whisperTo);
    const pool = (g && g.team === 'evil' ? sc.minions : sc.villagers) || [];
    const next = pool.filter(r => r !== (g && g.role));
    if (next.length) send({ type: 'stTwist', target: whisperTo, action: 'changeRole', role: next[Math.floor(Math.random() * next.length)] });
    whisperTo = null; render();
  }
  else if (a === 'stPoison') { send({ type: 'stAction', target: whisperTo, action: 'poison' }); }
  else if (a === 'stKill') { send({ type: 'stAction', target: whisperTo, action: 'kill' }); whisperTo = null; render(); }
  else if (a === 'stRevive') { send({ type: 'stAction', target: whisperTo, action: 'revive' }); }
  else if (a === 'stGhost') { send({ type: 'stAction', target: whisperTo, action: 'ghost' }); }
  else if (a === 'sendWhisper') {
    const el = document.getElementById('whisperText');
    const text = el && el.value.trim();
    if (text) send({ type: 'stMessage', target: whisperTo, text });
    whisperTo = null; render();
  }
});

render();
connect();
