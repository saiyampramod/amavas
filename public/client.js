/* AMAVAS client — cyber-noir dossier UI */
const app = () => document.getElementById('app');
const overlay = () => document.getElementById('overlay');
let ws, state = null, myToken = localStorage.getItem('nf_token');
let joinError = '', selected = null, sheet = null, drawer = false, roleOpen = false, sheetScript = null;
let whisperTo = null;
let lastName = localStorage.getItem('nf_name') || '';
let catalog = null;            // story modes + casts, sent on connect
let booted = false;            // has the opening screen finished?
let connected = false, slowWake = false, learnOpen = false, learnMode = null;
let gate = 'welcome';          // welcome (title) -> join (name + room)
let ackedIntel = 0, lastRoleSeen = null, sheetOpen = false, ackedHeadline = null;
// Two ways to see your role: hold the card for a glance, or tap Show to keep it up.
// `roleShown` is the sticky one, `peeking` is the transient hold. The earlier hold-only
// version broke because the reveal lived as a class on an element that any incoming game
// update replaced — so now the class is derived from state, applied directly for
// instant feedback, and released from the document so a hold can never get stuck on.
let confirmLeave = false, roleShown = false, peeking = false;
let unreadRecords = false, seenIntel = 0;

const roleVisible = () => roleShown || peeking;
function paintReveal() {
  const area = document.getElementById('revealArea');
  if (area) area.classList.toggle('revealing', roleVisible());
}
function setPeek(on) {
  if (peeking === on) return;
  peeking = on;
  paintReveal();
}
const peekStart = e => {
  const card = e.target.closest && e.target.closest('[data-peek]');
  if (!card || roleShown) return;          // already up: let them scroll it instead
  e.preventDefault();
  setPeek(true);
};
const peekEnd = () => setPeek(false);
document.addEventListener('pointerdown', peekStart, { passive: false });
document.addEventListener('pointerup', peekEnd);
document.addEventListener('pointercancel', peekEnd);
document.addEventListener('touchstart', peekStart, { passive: false });   // fallback
document.addEventListener('touchend', peekEnd);
document.addEventListener('touchcancel', peekEnd);
document.addEventListener('mouseup', peekEnd);
window.addEventListener('blur', peekEnd);
document.addEventListener('contextmenu', e => {
  if (e.target.closest && e.target.closest('[data-peek]')) e.preventDefault();
});

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const send = o => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));
const ms = (n, cls) => `<span class="ms ${cls || ''}">${n}</span>`;

// ---------------------------------------------------------------- socket
let reopen = null;
function nudgeConnection() {
  if (!ws || ws.readyState === 3 /* CLOSED */) { if (reopen) reopen(); return; }
  if (ws.readyState === 1) { if (myToken) send({ type: 'join', token: myToken }); }
}

function connect() {
  let delay = 800;
  // A sleeping free-tier server can take ~30s to wake. Say so rather than look broken.
  setTimeout(() => { if (!connected) { slowWake = true; render(); } }, 4000);
  const open = () => {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => {
      delay = 800; connected = true; slowWake = false;
      if (myToken) send({ type: 'join', token: myToken });
      render();
    };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === 'hello') { catalog = m.scripts; render(); return; }
      if (m.type === 'joined') { myToken = m.token; localStorage.setItem('nf_token', myToken); }
      else if (m.type === 'left') {
        myToken = null; localStorage.removeItem('nf_token');
        state = null; joinError = ''; gate = 'welcome';
        confirmLeave = drawer = roleOpen = sheetOpen = false;
        render();
      }
      else if (m.type === 'error') { joinError = m.text; render(); }
      else if (m.type === 'state') {
        if (state && state.phase !== m.phase) { selected = null; sheet = null; }
        state = m; joinError = ''; render();
      }
    };
    ws.onclose = () => {
      connected = false; render();
      // reconnect quickly — a phone waking from a locked screen should be back in
      // the game in a second, not fifteen
      setTimeout(open, delay); delay = Math.min(delay * 2, 4000);
    };
    reopen = open;
    ws.onerror = () => ws.close();
  };
  open();
}

// ---------------------------------------------------------------- chrome
function topBar() {
  return `<header class="fixed top-0 w-full z-40 h-16 px-margin-sm flex justify-between items-center
      bg-surface/80 backdrop-blur-xl border-b border-white/10">
    <button data-act="drawer" class="relative p-2 -ml-2 text-on-surface-variant active:scale-95 transition">
      ${ms('receipt_long', 'o')}
      ${unreadRecords ? `<span class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-tertiary-container
        border-2 border-surface animate-pulse"></span>` : ''}
    </button>
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
// ---------------------------------------------------------------- opening screen
function bootScreen() {
  const msg = !connected
    ? (slowWake ? 'Waking the village…' : 'Lighting the lamps…')
    : 'Ready';
  return `<main class="min-h-dvh flex flex-col items-center justify-center px-gutter text-center gap-7 relative overflow-hidden">
    <div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(255,111,95,.10),transparent_62%)]"></div>
    <div class="w-32 h-32 rounded-full overflow-hidden boot-moon">${portraitSVG('Rakshasa', { size: 128 })}</div>
    <div class="boot-fade">
      <h1 class="font-display-lg text-display-lg text-primary tracking-tighter">AMAVAS</h1>
      <p class="font-label-caps text-label-caps text-text-muted uppercase tracking-[0.35em] mt-2">The moonless night</p>
    </div>
    <div class="w-40 h-[3px] rounded-full bg-surface-container overflow-hidden boot-fade">
      <div class="h-full w-1/3 bg-primary boot-bar"></div>
    </div>
    <p class="font-label-mono text-label-mono text-text-muted boot-fade">${esc(msg)}</p>
    ${slowWake ? `<p class="font-body-md text-[13.5px] text-text-muted max-w-[280px] boot-fade">
      The server sleeps when nobody is playing. This first wake takes up to half a minute.</p>` : ''}
  </main>`;
}

// ---------------------------------------------------------------- learn the game
function learnOverlay() {
  const modes = catalog || [];
  const sc = learnMode ? modes.find(m => m.id === learnMode) : null;

  if (sc) {
    const group = (label, kind) => {
      const rs = sc.roles.filter(r => r.kind === kind);
      if (!rs.length) return '';
      return `<h4 class="font-label-caps text-label-caps text-text-muted uppercase mt-6 mb-3">${label}</h4>
        <div class="flex flex-col gap-stack-gap">${rs.map(r => `
          <div class="glass-panel rounded-xl border border-border-subtle p-3 flex items-start gap-3">
            <div class="w-12 h-12 rounded-full overflow-hidden shrink-0">${portraitSVG(r.name, { size: 48 })}</div>
            <div class="min-w-0">
              <div class="font-headline-md text-[18px] leading-tight ${r.team === 'evil' ? 'text-tertiary-container' : 'text-primary'}">
                ${esc(r.icon || '')} ${esc(r.name)}</div>
              <p class="font-body-md text-[14px] text-on-surface-variant mt-1">${esc(r.blurb)}</p>
              ${r.how ? `<details class="mt-2">
                <summary class="font-label-caps text-[10px] text-primary uppercase tracking-wider cursor-pointer">How to play it</summary>
                <p class="font-body-md text-[13px] text-text-muted mt-1.5">${esc(r.how)}</p></details>` : ''}
            </div>
          </div>`).join('')}</div>`;
    };
    return `<div class="fixed inset-0 z-[70] bg-background/97 backdrop-blur-xl overflow-y-auto">
      <header class="sticky top-0 h-16 px-margin-sm flex items-center gap-2 bg-surface/90 backdrop-blur-xl border-b border-white/10">
        <button data-act="learnBack" class="p-2 -ml-2 text-on-surface-variant">${ms('arrow_back', 'o')}</button>
        <h2 class="font-headline-md text-headline-md text-primary tracking-tighter truncate flex-1">${esc(sc.name)}</h2>
        <button data-act="closeLearn" class="p-2 -mr-2 text-on-surface-variant">${ms('close', 'o')}</button>
      </header>
      <div class="px-gutter pb-12 max-w-lg mx-auto">
        <p class="font-label-mono text-[11px] text-primary uppercase tracking-wider mt-5">${esc(sc.tag)}</p>
        <p class="font-body-md text-body-md text-on-surface-variant mt-2">${esc(sc.blurb)}</p>
        ${group('Residents — good', 'villager')}${group('Outsiders — good, but awkward', 'outsider')}
        ${group('Minions — evil', 'minion')}${group('The demon', 'demon')}
      </div>
    </div>`;
  }

  const step = (n, title, body) => `<div class="flex gap-3">
    <span class="shrink-0 w-7 h-7 rounded-lg border border-border-subtle text-primary
      font-label-mono text-[11px] flex items-center justify-center">${n}</span>
    <div class="min-w-0"><div class="font-headline-md text-[17px] text-text-high-contrast">${title}</div>
    <p class="font-body-md text-[14.5px] text-on-surface-variant mt-1">${body}</p></div></div>`;

  return `<div class="fixed inset-0 z-[70] bg-background/97 backdrop-blur-xl overflow-y-auto">
    <header class="sticky top-0 h-16 px-margin-sm flex justify-between items-center bg-surface/90 backdrop-blur-xl border-b border-white/10">
      <h2 class="font-headline-md text-headline-md text-primary tracking-tighter">How to play</h2>
      <button data-act="closeLearn" class="p-2 -mr-2 text-on-surface-variant">${ms('close', 'o')}</button>
    </header>
    <div class="px-gutter pb-12 max-w-lg mx-auto flex flex-col gap-8">
      <section class="pt-5">
        <p class="font-body-lg text-body-lg text-on-surface-variant">
          Everyone is a resident of one apartment society. One of you is a
          <b class="text-tertiary-container">Rakshasa</b> — a demon that eats someone every night.
          Nobody knows who anyone is. <b class="text-on-surface">You talk out loud, face to face</b>;
          the phone only holds your secret and your vote.</p>
      </section>
      <section>
        <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-4">A round</h3>
        <div class="flex flex-col gap-4">
          ${step(1, 'Night', 'Phones down, nobody speaks. If your role acts at night, your phone asks you to pick someone. Then it tells you what you learned — and some of you are being lied to.')}
          ${step(2, 'Day', 'Someone is dead. Argue. Claim a role, or lie about one. Compare what people say they learned.')}
          ${step(3, 'Accuse', 'Anyone can accuse one person per day. If at least half the living agree, they go <i>on the block</i>. A later accusation needs <b>more</b> votes to take their place.')}
          ${step(4, 'Dusk', 'Whoever is on the block is cast out, and their role stays secret. Then night falls again.')}
        </div>
      </section>
      <section>
        <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3">Winning</h3>
        <div class="grid grid-cols-2 gap-2">
          <div class="glass-panel rounded-xl border border-primary/25 p-4">
            <p class="font-headline-md text-[17px] text-primary">Good wins</p>
            <p class="font-body-md text-[14px] text-on-surface-variant mt-1">the moment the demon dies.</p></div>
          <div class="glass-panel rounded-xl border border-tertiary-container/25 p-4">
            <p class="font-headline-md text-[17px] text-tertiary-container">Evil wins</p>
            <p class="font-body-md text-[14px] text-on-surface-variant mt-1">when evil is no longer outnumbered.</p></div>
        </div>
      </section>
      <section>
        <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3">Three things that trip people up</h3>
        <div class="flex flex-col gap-2">
          ${[['Dead players keep playing', 'You can still talk, argue and be believed. You get one ghost vote for the whole rest of the game — spend it well.'],
             ['Your information can be false', 'Poisoned and drunk players are told things that simply are not true, and they have no idea. A confident claim is not proof.'],
             ['Evil knows each other', 'The demon and its minions wake together on night one. Good players start knowing nothing at all.']]
            .map(([t, b]) => `<div class="glass-panel rounded-xl border border-border-subtle p-3">
              <p class="font-headline-md text-[16px] text-text-high-contrast">${t}</p>
              <p class="font-body-md text-[14px] text-on-surface-variant mt-1">${b}</p></div>`).join('')}
        </div>
      </section>
      <section>
        <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3">The story modes</h3>
        <p class="font-body-md text-[14.5px] text-on-surface-variant mb-3">
          Each one is a different cast with its own villain. Tap to meet them.</p>
        <div class="flex flex-col gap-stack-gap">${modes.map(m => `
          <button data-learn="${m.id}" class="dossier-card glass-panel rounded-xl border border-border-subtle p-3
            flex items-center gap-3 text-left active:scale-[.99]">
            <div class="w-12 h-12 rounded-full overflow-hidden shrink-0">${portraitSVG(m.demon, { size: 48 })}</div>
            <div class="min-w-0 flex-1">
              <div class="font-headline-md text-[18px] text-text-high-contrast">${esc(m.name)}</div>
              <div class="font-label-mono text-[11px] text-text-muted uppercase truncate">${esc(m.tag)}</div>
            </div>
            <span class="font-label-caps text-[9px] uppercase text-primary shrink-0">${m.roles.length} roles</span>
            ${ms('chevron_right', 'o')}
          </button>`).join('') || '<p class="font-label-mono text-label-mono text-text-muted">Connecting…</p>'}</div>
      </section>
    </div>
  </div>`;
}

// The title screen: two choices, nothing else.
function welcomeScreen() {
  return `<main class="min-h-dvh flex flex-col items-center justify-center px-gutter text-center gap-8 py-12 relative">
    <div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_38%,rgba(255,111,95,.10),transparent_60%)]"></div>
    <div class="flex flex-col items-center gap-6 boot-fade">
      <div class="w-36 h-36 rounded-full overflow-hidden boot-moon">${portraitSVG('Rakshasa', { size: 144 })}</div>
      <div>
        <h1 class="font-display-lg text-primary tracking-tighter" style="font-size:clamp(48px,17vw,76px);line-height:.95">AMAVAS</h1>
        <p class="font-label-caps text-label-caps text-text-muted uppercase tracking-[0.42em] mt-3">The moonless night</p>
      </div>
      <p class="font-body-lg text-body-lg text-on-surface-variant max-w-[19rem]">
        A Rakshasa has moved into your society.<br>One of you is lying.</p>
    </div>
    <div class="w-full max-w-sm flex flex-col gap-3 boot-fade">
      ${bigBtn('enter', 'Enter Amavas', 'login')}
      ${bigBtn('learn', 'Learn the game', 'menu_book', 'ghost')}
    </div>
    <p class="font-label-mono text-[11px] text-text-muted tracking-widest uppercase boot-fade">5–20 players · one room</p>
  </main>`;
}

function joinScreen() {
  return `<main class="min-h-dvh flex flex-col px-gutter pb-10">
    <div class="w-full max-w-sm mx-auto pt-4 shrink-0 flex items-center">
      <button data-act="backToWelcome" class="h-11 px-3 -ml-3 text-on-surface-variant flex items-center gap-1.5
        font-label-caps text-label-caps uppercase active:scale-95 transition">${ms('arrow_back', 'o')} Back</button>
    </div>
    <div class="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto gap-6 py-4">
      <div class="text-center shrink-0">
        <h2 class="font-headline-lg text-headline-lg text-text-high-contrast">Who's playing?</h2>
        <p class="font-body-md text-body-md text-on-surface-variant mt-2">
          Start a table for your group, or join one that's already open.</p>
      </div>

      <input id="nameInput" maxlength="16" autocomplete="off" placeholder="Your name" value="${esc(lastName)}"
        class="w-full h-14 shrink-0 px-4 rounded-xl bg-surface-container border border-border-subtle text-on-surface
        text-center font-body-lg text-body-lg placeholder:text-text-muted focus:border-primary/50 focus:ring-0"/>

      <div class="shrink-0">${bigBtn('create', 'Start a new game', 'add_circle')}</div>

      <div class="flex items-center gap-3 shrink-0">
        <span class="h-px flex-1 bg-border-subtle"></span>
        <span class="font-label-caps text-label-caps text-text-muted uppercase">or join with a code</span>
        <span class="h-px flex-1 bg-border-subtle"></span>
      </div>

      <div class="flex flex-col gap-3 shrink-0">
        <input id="codeInput" maxlength="4" autocomplete="off" placeholder="────"
          class="w-full h-16 shrink-0 px-4 rounded-xl bg-surface-container border border-border-subtle text-on-surface
          font-label-mono text-[30px] tracking-[0.45em] text-center uppercase placeholder:text-border-subtle
          focus:border-primary/50 focus:ring-0"/>
        ${bigBtn('join', 'Join that game', 'login', 'ghost')}
      </div>

      ${joinError ? `<p class="text-tertiary-container font-label-mono text-label-mono text-center shrink-0">${esc(joinError)}</p>` : ''}
    </div>
  </main>`;
}

const table = () => state.players.filter(p => !p.storyteller);

// The single most asked question at the table: who are we waiting for? Name them.
function waitingList(title, pending, done) {
  return `<div class="w-full glass-panel rounded-xl border p-4 text-left
      ${pending.length ? 'border-tertiary-container/40' : 'border-primary/30'}">
    <div class="flex items-center justify-between mb-2">
      <span class="font-label-caps text-label-caps uppercase ${pending.length ? 'text-tertiary-container' : 'text-primary'}">${esc(title)}</span>
      <span class="font-label-mono text-label-mono text-text-muted">${pending.length} left</span>
    </div>
    ${pending.length
      ? `<div class="flex flex-wrap gap-1.5">${pending.map(nm =>
          `<span class="px-2.5 py-1 rounded-full bg-tertiary-container/12 border border-tertiary-container/30
            text-tertiary-container font-body-md text-[14px]">${esc(nm)}</span>`).join('')}</div>`
      : `<p class="font-body-md text-[14px] text-primary">Everyone is done.</p>`}
    ${done && done.length ? `<div class="mt-3 pt-2.5 border-t border-border-subtle">
      <p class="font-label-caps text-[10px] text-text-muted uppercase mb-1.5">Done</p>
      <div class="flex flex-wrap gap-1.5">${done.map(nm =>
        `<span class="px-2.5 py-1 rounded-full bg-surface-container-high text-text-muted font-body-md text-[13.5px]">${esc(nm)}</span>`).join('')}</div>
    </div>` : ''}
  </div>`;
}

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
    <div class="flex flex-col gap-stack-gap">${table().map(p => `
      <div class="relative">${dossier(p)}
        ${you.host && p.id !== you.id && p.connected ? `<button data-makehost="${p.id}"
          class="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-2 rounded-lg bg-surface-container-high
          border border-border-subtle text-primary font-label-caps text-[9px] uppercase">Make host</button>` : ''}
      </div>`).join('')}</div>
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

// Dawn and dusk get their own beat. Without this the app skips to the next screen
// and people genuinely miss who died.
function headlineOverlay() {
  const h = state.headline;
  const grim = h.kind === 'death' || h.kind === 'cast-out';
  const tone = grim ? 'tertiary-container' : 'primary';
  const icon = h.kind === 'death' ? 'skull' : h.kind === 'cast-out' ? 'gavel'
    : h.kind === 'spared' ? 'shield' : 'wb_twilight';
  return `<div class="fixed inset-0 z-[78] bg-background/97 backdrop-blur-xl overflow-y-auto">
    <div class="min-h-dvh flex flex-col justify-center px-gutter py-10 max-w-lg mx-auto text-center">
      <div class="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,${grim ? 'rgba(255,111,95,.13)' : 'rgba(152,203,255,.10)'},transparent_62%)]"></div>
      <div class="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center
        bg-surface-container border border-${tone}/30 text-${tone} boot-moon">
        <span class="ms" style="font-size:38px">${icon}</span></div>
      <span class="font-label-caps text-label-caps text-${tone} uppercase tracking-widest">
        ${h.kind === 'cast-out' || h.kind === 'spared' ? 'Dusk' : `Dawn · Day ${h.day}`}</span>
      <h2 class="font-display-lg text-display-lg text-text-high-contrast mt-3 leading-tight">${esc(h.title)}</h2>
      <p class="font-body-lg text-body-lg text-on-surface-variant mt-4">${esc(h.body)}</p>
      <div class="mt-9">${bigBtn('ackHeadline', h.kind === 'death' || h.kind === 'cast-out' ? 'Who did this?' : 'Carry on', 'arrow_forward', 'primary')}</div>
    </div>
  </div>`;
}

// Anything new your role has learned, shown once, in your face — not buried in a list.
function intelOverlay() {
  const items = state.you.inbox.slice(ackedIntel);
  return `<div class="fixed inset-0 z-[75] bg-background/97 backdrop-blur-xl overflow-y-auto scanlines">
    <div class="min-h-dvh flex flex-col justify-center px-gutter py-10 max-w-lg mx-auto text-center">
      <div class="w-24 h-24 rounded-full mx-auto mb-6 overflow-hidden boot-moon">
        ${state.you.role ? portraitSVG(state.you.role, { size: 96 }) : ''}</div>
      <span class="font-label-caps text-label-caps text-primary uppercase tracking-widest">Only you can see this</span>
      <h2 class="font-headline-lg text-headline-lg text-text-high-contrast mt-3">
        ${items.length > 1 ? 'You learned some things' : 'You learned something'}</h2>
      <div class="flex flex-col gap-3 mt-7">${items.map(m => {
        const isRole = m.kind === 'role';
        return `<div class="glass-panel rounded-xl border p-5 ${isRole ? 'border-tertiary-container/50' : 'border-primary/30'}">
          <div class="font-label-mono text-[11px] uppercase tracking-wider ${isRole ? 'text-tertiary-container' : 'text-text-muted'}">
            ${isRole ? 'Your role has changed' : 'Night ' + (m.day + 1)}</div>
          <p class="font-body-lg text-body-lg text-on-surface mt-2">${esc(m.text)}</p>
        </div>`;
      }).join('')}</div>
      <p class="font-body-md text-[13.5px] text-text-muted mt-6">
        Some roles are fed lies and never find out. Say it out loud, or sit on it.</p>
      <div class="mt-6">${bigBtn('ackIntel', 'Keep it to myself', 'lock', 'primary')}</div>
    </div>
  </div>`;
}

// The full cast of the story mode in play — everyone may read this, it is not a secret.
function sheetOverlayScript() {
  const sc = state.script || {};
  const roles = (catalog || []).find(m => m.id === state.scriptId);
  const list = roles ? roles.roles : [];
  const group = (label, kind, note) => {
    const rs = list.filter(r => r.kind === kind);
    if (!rs.length) return '';
    return `<h4 class="font-label-caps text-label-caps text-text-muted uppercase mt-6 mb-1">${label}</h4>
      <p class="font-body-md text-[13px] text-text-muted mb-3">${note}</p>
      <div class="flex flex-col gap-stack-gap">${rs.map(r => `
        <div class="glass-panel rounded-xl border border-border-subtle p-3 flex items-start gap-3">
          <div class="w-11 h-11 rounded-full overflow-hidden shrink-0">${portraitSVG(r.name, { size: 44 })}</div>
          <div class="min-w-0">
            <div class="font-headline-md text-[17px] leading-tight ${r.team === 'evil' ? 'text-tertiary-container' : 'text-primary'}">
              ${esc(r.icon || '')} ${esc(r.name)}</div>
            <p class="font-body-md text-[13.5px] text-on-surface-variant mt-1">${esc(r.blurb)}</p>
            ${r.how ? `<details class="mt-2">
              <summary class="font-label-caps text-[10px] text-primary uppercase tracking-wider cursor-pointer">How to play it</summary>
              <p class="font-body-md text-[13px] text-text-muted mt-1.5">${esc(r.how)}</p></details>` : ''}
          </div>
        </div>`).join('')}</div>`;
  };
  return `<div class="fixed inset-0 z-[70] bg-background/97 backdrop-blur-xl overflow-y-auto">
    <header class="sticky top-0 h-16 px-margin-sm flex justify-between items-center bg-surface/90 backdrop-blur-xl border-b border-white/10">
      <div class="min-w-0">
        <h2 class="font-headline-md text-headline-md text-primary tracking-tighter truncate">${esc(sc.name || '')}</h2>
        <p class="font-label-mono text-[10px] text-text-muted uppercase tracking-widest">Character sheet</p>
      </div>
      <button data-act="closeSheetScript" class="p-2 -mr-2 text-on-surface-variant shrink-0">${ms('close', 'o')}</button>
    </header>
    <div class="px-gutter pb-12 max-w-lg mx-auto">
      <p class="font-body-md text-[14.5px] text-on-surface-variant mt-4">
        Every role that <b class="text-on-surface">could</b> be in this game. Not all of them are —
        that is the whole problem. Claiming one of these is free; proving it is not.</p>
      ${group('Residents', 'villager', 'Good.')}
      ${group('Outsiders', 'outsider', 'Good, and a liability.')}
      ${group('Minions', 'minion', 'Evil, and they know each other.')}
      ${group('The demon', 'demon', 'Kill it and good wins.')}
    </div>
  </div>`;
}

// In-app, because a native confirm() is blocked or ignored in an installed web app.
function leaveOverlay() {
  const mid = state.phase === 'night' || state.phase === 'day';
  return `<div class="fixed inset-0 z-[85] bg-background/95 backdrop-blur-xl flex flex-col justify-end">
    <div data-act="cancelLeave" class="flex-1"></div>
    <div class="rounded-t-3xl glass-panel border-t border-border-subtle px-gutter pt-5 pb-8">
      <div class="w-10 h-1 rounded-full bg-border-subtle mx-auto mb-5"></div>
      <h3 class="font-headline-lg text-headline-lg text-text-high-contrast">Leave this game?</h3>
      <p class="font-body-md text-body-md text-on-surface-variant mt-3">
        ${mid ? `You are in the middle of a round as <b class="text-on-surface">${esc(state.you.role || 'a player')}</b>.
                 Your seat is given up and your secret goes with it — you cannot come back into this game.`
              : 'You will be taken back to the start. You can join again with the room code.'}</p>
      <div class="flex flex-col gap-2 mt-6">
        ${bigBtn('reallyLeave', 'Yes, leave the game', 'logout', 'danger')}
        ${bigBtn('cancelLeave', 'Stay', 'close', 'ghost')}
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
        ${chip('Night ' + (state.dayNum + 1), pr.decoy ? 'mute' : 'primary')}
        ${pr.decoy
          ? `<h2 class="font-headline-lg text-[26px] leading-tight text-text-high-contrast mt-4">${esc(pr.text)}</h2>
             <p class="font-body-md text-[13px] text-text-muted mt-3">
               No power tonight, so this is purely for fun &mdash; it changes nothing, and nobody
               ever sees your answer. You are asked so every phone looks the same.</p>`
          : `<h2 class="font-headline-lg text-headline-lg text-text-high-contrast mt-4">${esc(pr.verb)} someone</h2>
             <p class="font-body-md text-body-md text-on-surface-variant mt-2">
               You are <span class="text-primary font-semibold">${esc(you.role)}</span>. ${esc(pr.text)}</p>`}
      </header>
      <div class="flex flex-col gap-stack-gap">${targets.map(p => dossier(p, { pick: true })).join('')}</div>
    </main>
    ${actionBar(bigBtn('confirmNight',
      selected ? (pr.decoy ? `It's ${nameOf(selected)}, obviously` : `${pr.verb} ${nameOf(selected)}`)
               : (pr.decoy ? 'Go on, pick someone' : 'Select a target'),
      'ads_click', pr.decoy ? 'ghost' : 'primary', !selected))}`;
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
        <div class="font-label-mono text-label-mono text-text-high-contrast mt-2">${state.waitingOn} left</div>
      </div>
    </div>
    ${state.yourChoice ? `<div class="w-full glass-panel rounded-xl border border-primary/30 p-4 mb-3">
        <p class="font-label-caps text-label-caps text-primary uppercase">You chose</p>
        <p class="font-headline-md text-headline-md text-text-high-contrast mt-1">
          ${esc(state.yourVerb || '')} ${esc(state.yourChoice)}</p>
      </div>` : ''}
    ${waitingList('Still to take their turn', state.waitingNames || [], state.actedNames || [])}
  </main>
  ${actionBar(bigBtn('', 'Waiting for the others', 'lock', 'ghost', true))}`;
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
    ${waitingList('Still to vote', n.pending || [], n.voted || [])}
    ${(n.ghostsPending || []).length ? `<p class="font-body-md text-[13px] text-text-muted mt-2 text-center">
      ${n.ghostsPending.length} ghost(s) may still spend a vote &mdash; the vote does not wait for them.</p>` : ''}
    <h3 class="font-label-caps text-label-caps text-text-muted uppercase mb-3 mt-6 flex justify-between">
      <span>The society</span>${ms('groups', 'o')}</h3>
    <div class="flex flex-col gap-stack-gap">${pending.map(p => dossier(p)).join('')}</div>
  </main>
  ${actionBar(
    n.youEligible && !n.youVoted
      ? (!you.alive
          ? `<p class="text-center font-body-md text-[13.5px] text-text-muted mb-2">
               You have one vote for the whole game. Spend it, or stay quiet and let the living decide.</p>
             ${bigBtn('voteYes', 'Spend my ghost vote', 'how_to_vote', 'danger')}`
          : `<div class="grid grid-cols-2 gap-3">
              ${bigBtn('voteYes', 'Cast out', 'gavel', 'danger')}
              ${bigBtn('voteNo', 'Spare', 'health_and_safety', 'primary')}</div>`)
      : bigBtn('', n.youEligible ? 'Your vote is in' : (you.alive ? 'You cannot vote' : 'Ghost vote spent'), 'check', 'ghost', true)
    + (you.host ? bigBtn('closeNom', 'Host: close vote now', 'timer_off', 'ghost') : ''))}`;
}

function dayScreen() {
  const you = state.you;
  if (state.nomination) return voteScreen();
  const ghost = !you.alive;
  return `${topBar()}
  <main class="pt-24 pb-safe-bottom px-gutter max-w-lg mx-auto fade-up">
    ${ghost ? ghostHero() : `<header class="text-center mb-5">
      ${chip('Day ' + state.dayNum, 'mute')}
      <h2 class="font-headline-lg text-headline-lg text-text-high-contrast mt-4">Society Meeting</h2>
      <p class="font-body-md text-body-md text-on-surface-variant mt-2">
        Talk it out loud, face to face. Then accuse and vote here.</p>
    </header>`}
    ${state.youOwnRoom && !state.you.host ? `<div class="glass-panel rounded-xl border border-tertiary-container/40 p-3 mb-4
        flex items-center justify-between gap-3">
        <p class="font-body-md text-[14px] text-on-surface-variant min-w-0">
          <b class="text-on-surface">${esc((state.players.find(p => p.host) || {}).name || 'Someone else')}</b> is running your game.</p>
        <button data-act="reclaimHost" class="shrink-0 px-3 py-2 rounded-lg border border-tertiary-container/50
          text-tertiary-container font-label-caps text-label-caps uppercase">Take back</button>
      </div>` : ''}
    ${state.headline ? `<div class="glass-panel rounded-xl border p-4 mb-5 flex items-center gap-3
        ${state.headline.kind === 'death' ? 'border-tertiary-container/35' : 'border-border-subtle'}">
        <span class="ms shrink-0 ${state.headline.kind === 'death' ? 'text-tertiary-container' : 'text-text-muted'}"
          style="font-size:26px">${state.headline.kind === 'death' ? 'skull' : 'wb_twilight'}</span>
        <div class="min-w-0">
          <p class="font-label-caps text-label-caps text-text-muted uppercase">Last night</p>
          <p class="font-headline-md text-[18px] text-text-high-contrast leading-tight">${esc(state.headline.title)}</p>
        </div>
      </div>` : ''}
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
  // Everything must fit one screen — nobody should be scrolling to read their own role.
  return `<div class="fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl flex flex-col
      px-gutter pt-12 pb-5 overflow-hidden">
    <button data-act="closeRole" class="absolute top-3 right-3 p-2 text-on-surface-variant z-20">${ms('close', 'o')}</button>
    <p class="text-center font-label-caps text-label-caps text-text-muted uppercase tracking-[0.25em] mb-2 shrink-0">
      ${roleShown ? 'Hide it before you put the phone down' : 'Hold the card, or tap Show'}</p>
    <div id="revealArea" data-peek="1"
      class="relative w-full max-w-sm mx-auto flex-1 min-h-0 rounded-3xl overflow-hidden
      border border-border-subtle bg-surface-container-low scanlines${roleVisible() ? ' revealing' : ''}
      ${roleShown ? '' : 'select-none'}"
      style="touch-action:${roleShown ? 'pan-y' : 'none'};-webkit-touch-callout:none">
      <div class="absolute inset-0 flex flex-col px-5 py-4 gap-2">
        <div class="shrink-0 flex flex-col items-center text-center gap-2">
          <div class="w-20 h-20 rounded-full overflow-hidden">${portraitSVG(you.role, { size: 80 })}</div>
          <h3 class="font-headline-lg text-[27px] leading-none text-${tone} tracking-tight">${esc(you.role)}</h3>
          <div class="px-3 py-0.5 rounded-full bg-${tone}/10 border border-${tone}/20">
            <span class="font-label-caps text-label-caps text-${tone} uppercase">${evil ? 'Evil' : 'Good'}</span></div>
          <p class="font-body-md text-[14.5px] leading-snug text-on-surface">${esc(you.blurb || '')}</p>
        </div>
        ${you.how ? `<div class="flex-1 min-h-0 overflow-y-auto pt-2 mt-1 border-t border-border-subtle text-left"
            style="touch-action:pan-y">
          <p class="font-label-caps text-[10px] text-primary uppercase tracking-wider mb-1">How to play it</p>
          <p class="font-body-md text-[12.5px] leading-snug text-on-surface-variant">${esc(you.how)}</p>
        </div>` : ''}
      </div>
      <div class="veil absolute inset-0 z-10 flex flex-col items-center justify-center px-8 text-center"
        style="background:radial-gradient(circle at center, rgba(30,31,38,.85) 0%, rgba(17,19,25,1) 100%)">
        <div class="relative w-24 h-24 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full border-2 border-primary/20 pulse-ring"></div>
          <div class="absolute inset-0 rounded-full border border-primary/40 border-t-transparent animate-[spin_4s_linear_infinite]"></div>
          <div class="w-16 h-16 rounded-full bg-surface-container border border-border-subtle
            flex items-center justify-center text-primary">${ms('fingerprint', 'o')}</div>
        </div>
        <p class="font-label-mono text-label-mono text-on-surface-variant mt-5">HOLD TO PEEK</p>
        <p class="font-body-md text-[13.5px] text-text-muted mt-2">
          Press anywhere on this card and hold. Check nobody is reading over your shoulder.</p>
      </div>
    </div>
    <div class="w-full max-w-sm mx-auto mt-3 shrink-0">
      ${roleShown
        ? bigBtn('toggleRole', 'Hide my role', 'visibility_off', 'ghost')
        : bigBtn('toggleRole', 'Show my role', 'visibility', 'primary')}
    </div>
  </div>`;
}

// Who is running the game, stated plainly — and if the controls were lent out while the
// owner's phone was dark, a one-tap way to take them back.
function hostCard() {
  const host = state.players.find(p => p.host);
  const owner = state.owner;
  const lentOut = !!(owner && host && host.name !== owner.name);
  return `<div class="glass-panel rounded-xl border p-4 mt-3
      ${lentOut && state.youOwnRoom ? 'border-tertiary-container/40' : 'border-border-subtle'}">
    <p class="font-label-caps text-label-caps text-text-muted uppercase">Running the game</p>
    <p class="font-headline-md text-[19px] text-text-high-contrast mt-1">
      ${esc(host ? host.name : 'nobody')}${state.you.host ? ' <span class="text-primary text-[14px] font-label-mono">— you</span>' : ''}</p>
    ${lentOut ? `<p class="font-body-md text-[13.5px] text-text-muted mt-1">
        This room belongs to ${esc(owner.name)}${state.youOwnRoom ? ' — that is you' : ''}.
        The controls were handed over while they were offline.</p>` : ''}
    ${state.youOwnRoom && !state.you.host
      ? `<div class="mt-3">${bigBtn('reclaimHost', 'Take the controls back', 'undo', 'primary')}</div>`
      : ''}
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
        ${hostCard()}
        <div class="mt-3">${bigBtn('openSheet', 'Character sheet for this story', 'menu_book', 'ghost')}</div>
      </section>
      <section>
        <h3 class="font-label-caps text-label-caps text-primary uppercase mb-3 flex items-center gap-2">
          ${ms('lock', 'o')} Your secret intel</h3>
        ${inbox.length ? `<div class="flex flex-col gap-2">${inbox.map(m => {
          const isRole = m.kind === 'role';
          return `<div class="glass-panel rounded-xl border-l-2 p-3 ${isRole ? 'border-tertiary-container bg-tertiary-container/5' : 'border-primary'}">
            <div class="font-label-mono text-[11px] uppercase flex items-center gap-1.5 ${isRole ? 'text-tertiary-container' : 'text-text-muted'}">
              ${isRole ? ms('swap_horiz', 'o') + ' Your role changed' : 'Night ' + (m.day + 1)}</div>
            <div class="font-body-md text-body-md text-on-surface mt-1">${esc(m.text)}</div></div>`;
        }).join('')}</div>`
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
  if (typeof maybeFinishBoot === 'function') maybeFinishBoot();
  if (!booted) { app().innerHTML = bootScreen(); overlay().innerHTML = ''; return; }
  if (!state || !state.you) {
    roleOpen = drawer = false; sheet = null;
    app().innerHTML = gate === 'welcome' ? welcomeScreen() : joinScreen();
    overlay().innerHTML = learnOpen ? learnOverlay() : '';
    wire(); return;
  }
  const s = state.phase;
  const st = state.you.storyteller;
  // a fresh role means a fresh game — let its first secrets pop
  if (state.you.role !== lastRoleSeen) {
    lastRoleSeen = state.you.role; ackedIntel = 0; seenIntel = 0; unreadRecords = false;
  }
  const inbox = state.you.inbox || [];
  const newIntel = !st && inbox.length > ackedIntel;
  // anything new stays flagged on the Records button until they actually open it
  if (inbox.length > seenIntel) { seenIntel = inbox.length; unreadRecords = true; }
  app().innerHTML = s === 'lobby' ? lobbyScreen()
    : st ? stScreen()
    : s === 'night' ? nightScreen()
    : s === 'day' ? dayScreen()
    : s === 'over' ? overScreen() : '';
  const newHeadline = state.headline && state.headline.id !== ackedHeadline && state.phase !== 'over';
  overlay().innerHTML = confirmLeave ? leaveOverlay()
    : state.offer ? offerOverlay()
    : state.decision ? decisionOverlay()
    : newHeadline ? headlineOverlay()
    : newIntel ? intelOverlay()
    : sheetOpen ? sheetOverlayScript()
    : whisperTo ? whisperOverlay()
    : sheetScript ? rolesOverlay()
    : roleOpen ? roleOverlay() : drawer ? drawerOverlay() : sheet ? sheetOverlay() : '';
  // A full-screen overlay is fixed, but the page behind it can still scroll on iOS,
  // which reads as the card sliding around under your thumb. Freeze it while one is open.
  document.body.style.overflow = overlay().innerHTML ? 'hidden' : '';
  wire();
}

function wire() {
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
  const learnBtn = e.target.closest('[data-learn]');
  if (learnBtn) { learnMode = learnBtn.dataset.learn; render(); return; }
  const rolesBtn = e.target.closest('[data-roles]');
  if (rolesBtn) { sheetScript = rolesBtn.dataset.roles; render(); return; }
  const sc = e.target.closest('[data-script]');
  if (sc) { send({ type: 'setScript', id: sc.dataset.script }); return; }
  const mh = e.target.closest('[data-makehost]');
  if (mh) { send({ type: 'makeHost', target: mh.dataset.makehost }); return; }
  const md = e.target.closest('[data-mode]');
  if (md) { send({ type: 'setStoryteller', on: md.dataset.mode === 'storyteller' }); return; }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const a = btn.dataset.act;
  if (a === 'ackHeadline') { ackedHeadline = state.headline && state.headline.id; render(); }
  else if (a === 'ackIntel') { ackedIntel = (state.you.inbox || []).length; render(); }
  else if (a === 'openSheet') { sheetOpen = true; drawer = false; render(); }
  else if (a === 'closeSheetScript') { sheetOpen = false; render(); }
  else if (a === 'enter') { gate = 'join'; joinError = ''; render(); }
  else if (a === 'backToWelcome') { gate = 'welcome'; joinError = ''; render(); }
  else if (a === 'learn') { learnOpen = true; learnMode = null; render(); }
  else if (a === 'closeLearn') { learnOpen = false; learnMode = null; render(); }
  else if (a === 'learnBack') { learnMode = null; render(); }
  else if (a === 'join') doJoin(false);
  else if (a === 'create') doJoin(true);
  else if (a === 'leave') { confirmLeave = true; render(); }
  else if (a === 'cancelLeave') { confirmLeave = false; render(); }
  else if (a === 'reallyLeave') { confirmLeave = false; send({ type: 'leave' }); }
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
  else if (a === 'role') { roleOpen = true; drawer = false; roleShown = peeking = false; render(); }
  else if (a === 'closeRole') { roleOpen = false; roleShown = peeking = false; render(); }
  else if (a === 'toggleRole') { roleShown = !roleShown; peeking = false; render(); }
  else if (a === 'drawer') { drawer = true; roleOpen = false; unreadRecords = false; render(); }
  else if (a === 'closeDrawer') { drawer = false; render(); }
  else if (a === 'closeRoles') { sheetScript = null; render(); }
  else if (a === 'copyLink') {
    const url = location.origin + '/?room=' + encodeURIComponent(state.code || '');
    const done = () => { btn.textContent = 'Copied'; setTimeout(render, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt('Copy this link:', url));
    else prompt('Copy this link:', url);
  }
  else if (a === 'reclaimHost') send({ type: 'reclaimHost' });
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

// ---------------------------------------------------------------- app behaviour
// Keep the phone awake. A round can be ten minutes of talking with nobody touching a screen,
// and having everyone's phone lock mid-vote is miserable.
let wakeLock = null;
async function keepAwake() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* denied, or battery saver — not worth telling the player */ }
}
// A phone coming back from a locked screen must rejoin at once — waiting for the next
// failed heartbeat is what made people feel kicked out.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    // never leave a role on screen when the phone is handed over or put down
    if (roleShown || peeking) { roleShown = peeking = false; render(); }
    return;
  }
  if (!wakeLock) keepAwake();
  nudgeConnection();
  render();
});
window.addEventListener('online', nudgeConnection);
window.addEventListener('pageshow', nudgeConnection);
window.addEventListener('focus', nudgeConnection);
document.addEventListener('click', () => { if (!wakeLock) keepAwake(); }, { once: true });

// Two layers of keepalive: a light ws message so proxies see traffic, and an occasional
// HTTP hit so a free-tier host counts the service as in use during a long discussion.
setInterval(() => { if (ws && ws.readyState === 1) send({ type: 'ping' }); }, 25000);
setInterval(() => {
  if (state && state.you) fetch('/healthz', { cache: 'no-store' }).catch(() => {});
}, 4 * 60 * 1000);

// ---------------------------------------------------------------- boot
function maybeFinishBoot() {
  if (booted) return;
  if (!connected || !bootMinElapsed || !fontsReady) return;
  booted = true;
  render();
}
let bootMinElapsed = false, fontsReady = false;
// an invite link goes straight to the join step — they already know where they're going
if (new URLSearchParams(location.search).get('room')) gate = 'join';
setTimeout(() => { bootMinElapsed = true; maybeFinishBoot(); }, 1500);
(document.fonts ? document.fonts.ready : Promise.resolve())
  .then(() => { fontsReady = true; maybeFinishBoot(); });

render();
connect();
