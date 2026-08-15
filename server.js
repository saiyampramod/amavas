// AMAVAS — a house-party social deduction game set in a Bengaluru apartment society.
// (Original game in the Clocktower/Werewolf genre — played in person, phones in hand.)
// Run: node server.js   → players join from phones at http://<your-pc-ip>:3000

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------- roles
const { ROLES, SCRIPTS, FILLER } = require('./roles.js');
const scriptOf = () => SCRIPTS[game.scriptId] || SCRIPTS.amavas;

// players → [outsiders, minions]; villagers = rest (unique roles, then extra Aam Aadmi); demon always 1
const SETUP = {
  5: [0, 1], 6: [1, 1], 7: [0, 1], 8: [1, 1], 9: [2, 1],
  10: [0, 2], 11: [1, 2], 12: [2, 2],
  13: [0, 3], 14: [1, 3], 15: [2, 3],
  16: [0, 4], 17: [1, 4], 18: [2, 4], 19: [2, 4], 20: [2, 4],
};
const MIN_PLAYERS = 5, MAX_PLAYERS = 20;

// ---------------------------------------------------------------- state
// Many groups can play at once. Each room is a self-contained game; `game` always points
// at the room currently being served. Every entry point sets it before touching anything,
// and decide() restores it after any await (see below) so a paused night in one room
// cannot be corrupted by traffic in another.
const rooms = new Map();      // code -> game
let game = null;
const sockets = new Map();    // ws -> { playerId, code }

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable I/O/0/1
function newRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom() {
  const code = newRoomCode();
  const prev = game;
  game = null;                       // freshGame() reads `game` for the previous script
  const g = freshGame();
  g.code = code;
  g.createdAt = Date.now();
  rooms.set(code, g);
  game = prev;
  return g;
}

function useRoom(g) { game = g; return g; }

// Drop rooms nobody is connected to, so a long-lived server doesn't accumulate them.
// Seats are kept while a game is running so people can reconnect, which means an
// abandoned game holds its players until this clears it.
const ROOM_TTL = Number(process.env.ROOM_TTL_MS || 20 * 60 * 1000);
function sweepRooms() {
  const now = Date.now();
  for (const [code, g] of rooms) {
    const live = g.players.some(p => p.ws && p.ws.readyState === 1);
    if (!live && now - (g.lastSeen || g.createdAt || 0) > ROOM_TTL) rooms.delete(code);
  }
}
setInterval(sweepRooms, Math.min(ROOM_TTL, 2 * 60 * 1000)).unref();

function freshGame() {
  return {
    phase: 'lobby', // lobby | night | day | over
    code: game ? game.code : null,
    scriptId: (game && game.scriptId) || 'amavas',
    doubleKill: false,      // Kasai: demon feeds twice next night
    todayYesVoters: [],     // Secretary: who raised a hand today
    pendingDecision: null,  // a judgement call waiting on the Storyteller
    resolving: false,
    director: true,         // the unseen storyteller — quietly keeps games from ending too early
    directorLog: [],        // what it did, revealed only when the game is over
    directorSaves: 0,       // game-ending night kills it has turned aside
    pendingOffer: null,     // a defection only its recipient can see
    defectionOffered: false,
    headline: null,         // the last big beat — dawn deaths, dusk executions
    dayNum: 0,
    players: [],
    log: [],
    nightActions: {},
    nightNeeded: [],
    executedToday: null,
    onBlock: null,
    onBlockVotes: 0,
    nomination: null,
    winner: null,
    winReason: '',
  };
}

// The Storyteller (if any) sits in game.players so join/rejoin/broadcast work,
// but is never dealt a role and never counts for anything in the game itself.
const seated = () => game.players.filter(p => !p.storyteller);
const alive = () => seated().filter(p => p.alive);
const byId = id => game.players.find(p => p.id === id);
const theST = () => game.players.find(p => p.storyteller);
const stMode = () => !!theST();
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];

function log(text) { game.log.push({ day: game.dayNum, phase: game.phase, text }); }

// A death or an execution deserves its own beat. Without one the app skips straight to
// the next screen and players genuinely miss who died.
function headline(kind, title, body) {
  game.headline = { id: crypto.randomUUID(), kind, title, body, day: game.dayNum };
}

// ---------------------------------------------------------------- messaging
function send(p, msg) { if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); }
// kind: 'intel' (default) or 'role' — a role change is flagged so the client can mark it
function tell(p, text, kind) { p.inbox.push({ day: game.dayNum, text, kind: kind || 'intel' }); }

function publicPlayer(p) {
  return { id: p.id, name: p.name, seat: p.seat, alive: p.alive, ghostVote: p.ghostVote,
    host: p.host, storyteller: !!p.storyteller, connected: !!(p.ws && p.ws.readyState === 1) };
}

// Everything the Storyteller can see. Never sent to anyone else.
function grimoire() {
  return seated().map(p => ({
    id: p.id, name: p.name, alive: p.alive, ghostVote: p.ghostVote,
    role: p.role, believes: p.shownRole !== p.role ? p.shownRole : null,
    team: p.role ? ROLES[p.role].team : null,
    kind: p.role ? ROLES[p.role].kind : null,
    icon: p.role ? ROLES[p.role].icon : null,
    poisoned: !!p.poisoned, protectedTonight: !!p.protected,
    connected: !!(p.ws && p.ws.readyState === 1),
    acted: game.phase === 'night' ? (p.id in game.nightActions) : null,
    needsToAct: game.phase === 'night' ? game.nightNeeded.includes(p.id) : null,
    target: game.nightActions[p.id] ? (byId(game.nightActions[p.id]) || {}).name : null,
    yesVotes: p.yesVotes || 0,
  }));
}

// Every story mode and its cast. Sent on connect so the tutorial works before joining.
function scriptCatalogue() {
  return Object.entries(SCRIPTS).map(([id, sc]) => ({
    id, name: sc.name, tag: sc.tag, blurb: sc.blurb, difficulty: sc.difficulty,
    demon: sc.demon, demonIcon: ROLES[sc.demon].icon,
    roles: [...sc.villagers, FILLER, ...sc.outsiders, ...sc.minions, sc.demon]
      .map(r => ({ name: r, icon: ROLES[r].icon, team: ROLES[r].team, kind: ROLES[r].kind,
        blurb: ROLES[r].blurb, how: ROLES[r].how })),
  }));
}

function stateFor(p) {
  const s = {
    type: 'state',
    phase: game.phase,
    dayNum: game.dayNum,
    players: game.players.map(publicPlayer),
    log: game.log,
    you: p ? {
      id: p.id, name: p.name, alive: p.alive, ghostVote: p.ghostVote, host: p.host,
      storyteller: !!p.storyteller,
      role: p.shownRole, blurb: p.shownRole ? ROLES[p.shownRole].blurb : null,
      // deliberately the SHOWN role's advice — an Old Monk must read as their fake role
      how: p.shownRole ? ROLES[p.shownRole].how : null,
      icon: p.shownRole ? ROLES[p.shownRole].icon : null,
      team: p.role ? (ROLES[p.role].team === 'evil' ? 'evil' : 'good') : null,
      inbox: p.inbox,
      hunterUsed: p.hunterUsed,
      canShoot: game.phase === 'day' && p.alive && p.shownRole === 'Slayer' && !p.hunterUsed,
    } : null,
    minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS,
    winner: game.winner, winReason: game.winReason,
    scriptId: game.scriptId,
    script: { id: game.scriptId, ...scriptOf() },
    code: game.code,
    headline: game.headline,
    storyteller: theST() ? { id: theST().id, name: theST().name } : null,
    mode: theST() ? 'storyteller' : 'host',
    director: game.director,
    seatedCount: seated().length,
  };
  // A defection is visible only to the player being tempted.
  if (p && game.pendingOffer && game.pendingOffer.playerId === p.id) {
    s.offer = { title: game.pendingOffer.title, body: game.pendingOffer.body };
  }
  if (game.phase === 'over') s.directorLog = game.directorLog;
  if (p && p.storyteller) {
    s.grimoire = grimoire();
    const d = game.pendingDecision;
    s.decision = d ? {
      id: d.id, title: d.title, detail: d.detail, about: d.about,
      options: d.options.map(o => ({ id: o.id, label: o.label, hint: o.hint || null })),
    } : null;
  }
  if (game.phase === 'lobby') s.scripts = scriptCatalogue();
  if (game.phase === 'over') {
    // players who joined after the game ended have no role yet — they are in the
    // next game, not this reveal
    s.reveal = seated().filter(q => q.role).map(q => ({
      name: q.name, role: q.role, believed: q.role !== q.shownRole ? q.shownRole : null,
      team: ROLES[q.role].team, kind: ROLES[q.role].kind, icon: ROLES[q.role].icon, alive: q.alive,
    }));
  }
  if (game.phase === 'night' && p) {
    s.needsAction = game.nightNeeded.includes(p.id) && !(p.id in game.nightActions);
    s.actionPrompt = p.nightPrompt || null;
    s.waitingOn = game.nightNeeded.filter(id => !(id in game.nightActions)).length;
    const chose = game.nightActions[p.id];
    s.yourChoice = chose ? (byId(chose) || {}).name : null;
    s.yourVerb = p.nightPrompt ? p.nightPrompt.verb : null;
  }
  if (game.phase === 'day') {
    s.onBlock = game.onBlock ? byId(game.onBlock).name : null;
    s.onBlockVotes = game.onBlockVotes;
    if (game.nomination) {
      const n = game.nomination;
      s.nomination = {
        nominator: byId(n.nominatorId).name,
        nominee: byId(n.nomineeId).name,
        votesCast: Object.keys(n.votes).length,
        votersTotal: n.eligible.length,
        youVoted: p ? (p.id in n.votes) : true,
        youEligible: p ? n.eligible.includes(p.id) : false,
      };
    }
    if (p) {
      s.canNominate = p.alive && !p.nominatedToday && !game.nomination;
      s.nominees = seated().filter(q => q.alive && !q.wasNominatedToday).map(q => ({ id: q.id, name: q.name }));
    }
  }
  return s;
}

function broadcast() { for (const p of game.players) send(p, stateFor(p)); }

// ---------------------------------------------------------------- registration (what powers perceive)
// What a role LOOKS like to a power tonight (Naqab paints someone as the demon).
function registersAs(target) { return target.registerAs || target.role; }

function registersEvil(target) {
  if (target.registerAs) return ROLES[target.registerAs].team === 'evil';
  if (target.role === 'Influencer') return false;
  if (target.role === 'Chhaya') return false;           // the shadow always reads good
  // The Aghori's reading is settled once per night (by the Storyteller, or a coin flip).
  if (target.role === 'Aghori') return target.aghoriEvil !== null && target.aghoriEvil !== undefined
    ? target.aghoriEvil : Math.random() < 0.5;
  return ROLES[target.role].team === 'evil';
}

const isDemon = p => ROLES[p.role].kind === 'demon';
const livingDemon = () => seated().find(p => p.role && isDemon(p) && p.alive);

// ---------------------------------------------------------------- the unseen storyteller
// Nobody sits out. The engine quietly watches the balance and, ONLY when the game looks
// like it is about to end too soon, leans on the calls it was going to make anyway.
// Players are never told. Everything it does is recorded privately and revealed at the end.

function balance() {
  const liv = alive();
  const evilAlive = liv.filter(p => p.role && ROLES[p.role].team === 'evil').length;
  const goodAlive = liv.length - evilAlive;
  const demon = livingDemon();
  const evilRoles = seated().filter(p => p.role && ROLES[p.role].team === 'evil');
  const evilDead = evilRoles.filter(p => !p.alive).length;
  return {
    liv: liv.length, evilAlive, goodAlive, demon: !!demon,
    margin: goodAlive - evilAlive,        // evil wins when this hits 0
    evilDead, evilTotal: evilRoles.length,
    day: game.dayNum,
  };
}

// Which side needs a hand right now? null = leave it alone.
function favouredSide() {
  if (!game.director) return null;
  const b = balance();
  if (!b.demon) return null;                        // demon already dead, nothing to save
  if (b.margin <= 1) return 'good';                 // one more death and evil takes it
  if (b.liv <= 4) return 'good';                    // endgame closing fast
  if (b.day <= 2 && b.evilDead >= 1) return 'evil'; // good is dismantling evil ahead of schedule
  if (b.evilTotal && b.evilDead >= Math.ceil(b.evilTotal / 2) && b.day <= 3) return 'evil';
  return null;
}

function directorNote(text) {
  game.directorLog.push({ day: game.dayNum, text });
}

// ---------------------------------------------------------------- twists
// Quietly hand one player a role they did not sign up for, or offer them a way out.
// Both are secret: nobody else is ever told, and the public log stays silent.
function changeRole(t, newRole, note) {
  if (!t || !ROLES[newRole]) return false;
  const was = t.role;
  t.role = newRole;
  t.shownRole = newRole;
  t.selfSaveUsed = false; t.lastWard = null; t.hunterUsed = false;
  tell(t, note || `Something has shifted. You are now the ${newRole}.`, 'role');
  directorNote(`${t.name}: ${was} → ${newRole}.`);
  if (ROLES[newRole].team === 'evil') {
    const mates = seated().filter(q => q !== t && q.alive && ROLES[q.role].team === 'evil');
    if (mates.length) tell(t, `Your evil saath: ${mates.map(q => `${q.name} (${q.role})`).join(', ')}.`, 'role');
    for (const m of mates) tell(m, `${t.name} is with you now.`, 'role');
  }
  return true;
}

// An offer only the recipient ever sees. They answer on their own phone.
function offerDefection(t, toTeam) {
  if (!t || !t.alive || game.pendingOffer) return false;
  const pool = toTeam === 'evil'
    ? scriptOf().minions.filter(r => !seated().some(q => q.alive && q.role === r))
    : scriptOf().villagers.filter(r => !seated().some(q => q.alive && q.role === r));
  const newRole = pool.length ? pick(pool) : (toTeam === 'evil' ? scriptOf().minions[0] : FILLER);
  game.pendingOffer = {
    playerId: t.id, toTeam, newRole,
    title: toTeam === 'evil' ? 'Something in the dark is offering you a way out'
                             : 'A hand reaches for you out of the light',
    body: toTeam === 'evil'
      ? `The village is going to lose, and you can feel it. Turn now and you become the ${newRole} — you will know who the others are, and they will know you. Refuse and nobody ever hears of this.`
      : `You are tired of it. Turn now and you become the ${newRole}, and the demon loses a friend. Refuse and nobody ever hears of this.`,
  };
  directorNote(`Offered ${t.name} a way over to ${toTeam}.`);
  broadcast();
  return true;
}

function answerOffer(p, accept) {
  const o = game.pendingOffer;
  if (!o || o.playerId !== p.id) return;
  game.pendingOffer = null;
  if (accept) {
    changeRole(p, o.newRole, `You took it. You are the ${o.newRole} now.`);
    directorNote(`${p.name} accepted and is now ${o.newRole}.`);
  } else {
    tell(p, 'You turned it down. Nobody will ever know it was offered.');
    directorNote(`${p.name} refused.`);
  }
  broadcast();
}

// The director offers a defection only when the game is badly lopsided, and only once.
function maybeOfferDefection() {
  if (!game.director || theST() || game.pendingOffer || game.defectionOffered) return;
  const b = balance();
  if (!b.demon || b.liv < 5) return;
  let side = null;
  if (b.day <= 3 && b.evilTotal && b.evilDead >= b.evilTotal - 1 && b.evilAlive <= 1) side = 'evil';
  else if (b.margin <= 1 && b.evilAlive >= 2) side = 'good';
  if (!side) return;
  const candidates = alive().filter(q =>
    side === 'evil' ? ROLES[q.role].team === 'good' && ROLES[q.role].kind !== 'demon'
                    : ROLES[q.role].team === 'evil' && ROLES[q.role].kind === 'minion');
  if (!candidates.length) return;
  game.defectionOffered = true;
  offerDefection(pick(candidates), side);
}

// In auto mode the engine decides these itself (leaning on the director when the game
// needs it). With a human Storyteller, the game pauses and asks them instead.
function decide(spec) {
  // Capture the room. Awaiting a human Storyteller yields to the event loop, and other
  // rooms will move `game` while we wait — so every resumption re-points it at ours.
  const room = game;
  return rawDecide(spec).then(v => { game = room; return v; });
}

function rawDecide(spec) {
  const st = theST();
  if (!st || !(st.ws && st.ws.readyState === 1)) {
    const side = favouredSide();
    if (side && spec.favour) {
      const biased = spec.favour(side);
      if (biased !== undefined && biased !== null) {
        directorNote(`${spec.title} → nudged for ${side}.`);
        return Promise.resolve(biased);
      }
    }
    return Promise.resolve(spec.auto());
  }
  return new Promise(resolve => {
    game.pendingDecision = {
      id: crypto.randomUUID(),
      title: spec.title,
      detail: spec.detail || '',
      about: spec.about || null,          // player name this concerns
      options: spec.options,              // [{id, label, hint}]
      resolve,
      auto: spec.auto,
    };
    broadcast();
  });
}

function answerDecision(p, optionId) {
  const d = game.pendingDecision;
  if (!d || !p.storyteller) return;
  const opt = optionId === '__auto' ? null : d.options.find(o => o.id === optionId);
  if (optionId !== '__auto' && !opt) return;
  game.pendingDecision = null;
  d.resolve(opt ? opt.value : d.auto());
}

// ---------------------------------------------------------------- game start
function startGame() {
  const table = seated();
  const n = table.length;
  const [no, nm] = SETUP[n];
  const sc = scriptOf();
  const nv = n - 1 - no - nm; // villagers incl. extra Aam Aadmi
  const uniques = shuffle([...sc.villagers]).slice(0, Math.min(nv, sc.villagers.length));
  const fillers = Array(Math.max(0, nv - sc.villagers.length)).fill(FILLER);
  const roles = [
    ...uniques, ...fillers,
    ...shuffle([...sc.outsiders]).slice(0, no),
    ...shuffle([...sc.minions]).slice(0, nm),
    sc.demon,
  ];
  shuffle(roles);
  shuffle(table);
  table.forEach((p, i) => {
    p.seat = i;
    p.role = roles[i];
    p.shownRole = p.role;
    p.alive = true;
    p.ghostVote = true;
    p.hunterUsed = false;
    p.inbox = [];
    p.selfSaveUsed = false; p.lastWard = null; p.yesVotes = 0;
    p.voteBlockedDay = -1; p.executionSurvived = false;
    if (p.role === 'Old Monk') {
      // believes they are a powered resident role, ideally one not in play
      const unused = sc.villagers.filter(r => !roles.includes(r));
      p.shownRole = pick(unused.length ? unused : sc.villagers);
    }
    if (p.role === 'Pagal') p.shownRole = sc.demon; // sincerely believes they are the demon
  });
  game.players.sort((a, b) => (a.storyteller ? 99 : a.seat) - (b.storyteller ? 99 : b.seat));
  const st = theST();
  log(`${sc.name} — ${sc.tag}. ${n} players${st ? `, with ${st.name} storytelling` : ''}. Something evil has moved into the society...`);

  // evil team intro
  const evils = table.filter(p => ROLES[p.role].team === 'evil');
  for (const p of evils) {
    const mates = evils.filter(q => q !== p).map(q => `${q.name} (${q.role})`).join(', ');
    tell(p, mates ? `Your evil saath: ${mates}.` : 'You hunt alone. No minions this game.');
  }
  startNight();
}

// ---------------------------------------------------------------- night
function nightPromptFor(p) {
  const r = p.shownRole;
  if (!p.alive) return null;
  const others = () => alive().filter(q => q !== p);
  if (r === 'Tarot Aunty') return { verb: 'Read', text: 'Pull a card on a player to learn their alignment.', targets: others() };
  if (r === 'Exorcist') return { verb: 'Ward', text: 'Choose a player to ward against the demon tonight.', targets: alive() };
  if (r === 'Sadhu') return { verb: 'Bless', text: 'Choose a player to ward. Never the same player two nights running.', targets: alive() };
  if (r === 'Traffic Cop') return { verb: 'Check', text: 'Choose a player: learn if anything attacked them tonight.', targets: others() };
  if (r === 'Sapnewali') return { verb: 'Dream', text: 'Choose a player: you will learn two roles, one of them truly theirs.', targets: others() };
  if (r === 'Auditor') return { verb: 'Audit', text: 'Choose a player: learn how often they have voted to cast someone out.', targets: others() };
  if (r === 'Vishkanya' && p.role === 'Vishkanya') return { verb: 'Poison', text: 'Choose a player to poison until dusk.', targets: others() };
  if (r === 'Tantrik' && p.role === 'Tantrik') return { verb: 'Unbind', text: 'Choose a player: every ward protecting them fails tonight.', targets: others() };
  if (r === 'Naqab' && p.role === 'Naqab') return { verb: 'Mask', text: 'Choose a player: tonight every power reads them as the demon.', targets: others() };
  if (r === 'Broker' && p.role === 'Broker') return { verb: 'Buy', text: 'Choose a player: their vote counts for nothing tomorrow.', targets: others() };
  if (ROLES[r] && ROLES[r].kind === 'demon' && game.dayNum > 0)
    return { verb: 'Devour', text: 'Choose tonight\'s victim.', targets: others() };
  return null;
}

// Everyone is asked to do something at night, whether or not it does anything.
// If only the powerful got a prompt, anyone glancing at your phone would learn what
// you are — and the "3 still acting" counter would quietly leak how many powers are live.
const IDLE_PROMPTS = [
  { verb: 'Watch', text: 'Sleep is not coming. Choose someone to lie awake thinking about.' },
  { verb: 'Listen', text: 'You hear movement outside. Choose whose door you think it stopped at.' },
  { verb: 'Dream', text: 'You dream of the society. Choose whose face surfaces in it.' },
  { verb: 'Suspect', text: 'Choose the person you would least like to be alone with tonight.' },
];

function idlePromptFor(p) {
  const targets = alive().filter(q => q !== p);
  if (!targets.length) return null;
  const pick_ = IDLE_PROMPTS[(p.seat + game.dayNum) % IDLE_PROMPTS.length];
  return { verb: pick_.verb, text: pick_.text, targets, decoy: true };
}

function startNight() {
  game.phase = 'night';
  game.nightActions = {};
  game.nightNeeded = [];
  for (const p of seated()) {
    p.protected = false;
    p.nightPrompt = null;
    if (!p.alive) continue;
    const real = nightPromptFor(p);
    const prompt = real || idlePromptFor(p);
    if (prompt) {
      p.nightDecoy = !real;
      p.nightPrompt = {
        verb: prompt.verb, text: prompt.text,
        targets: prompt.targets.map(t => ({ id: t.id, name: t.name })),
      };
      game.nightNeeded.push(p.id);
    }
  }
  if (game.dayNum === 0) log('Night 1. The society sleeps under a black, moonless sky. Some of you learn things — check your phones, quietly.');
  else log(`Night ${game.dayNum + 1}. The streetlights flicker out. Those with powers, check your phones.`);
  broadcast();
  if (game.nightNeeded.length === 0) resolveNight();
}

function submitNightAction(p, targetId) {
  if (game.phase !== 'night' || !game.nightNeeded.includes(p.id) || p.id in game.nightActions) return;
  const t = byId(targetId);
  if (!t || !p.nightPrompt.targets.some(x => x.id === targetId)) return;
  game.nightActions[p.id] = targetId;
  const remaining = game.nightNeeded.filter(id => !(id in game.nightActions));
  if (remaining.length === 0) resolveNight();
  else broadcast();
}

// Plausible role names for bluffs and fuzzy reads — everything this script could contain.
function inPlayish() {
  const sc = scriptOf();
  return [...sc.villagers, ...sc.outsiders, FILLER];
}

function neighboursOf(p) {
  const liv = alive();
  const i = liv.indexOf(p);
  if (i === -1 || liv.length < 3) return [];
  return [liv[(i - 1 + liv.length) % liv.length], liv[(i + 1) % liv.length]];
}

async function resolveNight() {
  if (game.resolving) return;
  game.resolving = true;
  try { await runNight(); } finally { game.resolving = false; }
}

async function runNight() {
  const firstNight = game.dayNum === 0;
  const act = p => (p && game.nightActions[p.id]) ? byId(game.nightActions[p.id]) : null;
  const holder = role => seated().find(p => p.role === role && p.alive);
  const deaths = [];

  // a Storyteller-applied poison persists until they lift it
  for (const p of seated()) { p.poisoned = !!p.stPoisoned; p.registerAs = null; p.attacked = false; }

  // 1. poison
  const poisoner = holder('Vishkanya'), pt = act(poisoner);
  if (pt) { pt.poisoned = true; tell(poisoner, `You slipped poison to ${pt.name}.`); }

  // 1b. Naqab paints a target as the demon for every power tonight
  const naqab = holder('Naqab'), nt = act(naqab);
  if (nt && !naqab.poisoned) { nt.registerAs = scriptOf().demon; tell(naqab, `You masked ${nt.name} as the demon tonight.`); }
  else if (nt) tell(naqab, `You reached for ${nt.name}, but the mask would not hold.`);

  // 1c. Broker buys tomorrow's vote (dayNum is still today until dawn below)
  const broker = holder('Broker'), bt = act(broker);
  if (bt && !broker.poisoned) { bt.voteBlockedDay = game.dayNum + 1; tell(broker, `You bought ${bt.name}'s vote. Tomorrow it is worth nothing.`); }
  else if (bt) tell(broker, `${bt.name} would not take your money tonight.`);

  // 2. wards
  const exo = holder('Exorcist'), et = act(exo);
  if (et) { if (!exo.poisoned) et.protected = true; tell(exo, `You warded ${et.name} tonight.`); }

  const sadhu = holder('Sadhu'), st = act(sadhu);
  if (st) {
    const repeat = sadhu.lastWard === st.id;
    if (repeat && !sadhu.poisoned) {
      st.alive = false; deaths.push(st);
      tell(sadhu, `You blessed ${st.name} a second night running. The blessing curdled — they died in your hands.`);
    } else {
      if (!sadhu.poisoned) st.protected = true;
      tell(sadhu, `You blessed ${st.name} tonight.`);
    }
    sadhu.lastWard = st.id;
  }

  // 3. Tantrik strips wards
  const tantrik = holder('Tantrik'), tt = act(tantrik);
  if (tt && !tantrik.poisoned) { tt.protected = false; tell(tantrik, `You unbound every ward on ${tt.name}.`); }
  else if (tt) tell(tantrik, `You clawed at ${tt.name}'s wards, but nothing gave.`);

  // 4. demon kill(s)
  const demon = livingDemon();
  const bites = game.doubleKill ? 2 : 1;
  game.doubleKill = false;
  if (!firstNight && demon) {
    for (let bite = 0; bite < bites; bite++) {
      let t = bite === 0 ? act(demon) : pick(alive().filter(q => q !== demon));
      if (!t || !t.alive) continue;
      t.attacked = true;

      // The unseen storyteller's one blunt instrument: if this kill would end the game
      // on the spot and the night is still young, it simply doesn't land. Reads as a ward.
      if (game.director && !theST() && game.directorSaves < 2) {
        const b = balance();
        const endsItNow = b.margin <= 1 && ROLES[t.role].team === 'good';
        if (endsItNow && game.dayNum <= 4) {
          game.directorSaves++;
          directorNote(`${demon.role} went for ${t.name}; that would have ended the game, so it missed.`);
          tell(demon, `You reached for ${t.name} and something in the dark would not let you close your hand.`);
          continue;
        }
      }

      if (t.protected) {
        tell(demon, `You went for ${t.name}, but a ward burned you back.`);
        if (demon.role === 'Pishach') {                     // relentless: take someone else
          const pool = alive().filter(q => q !== demon && !q.protected && q !== t);
          const alt = pool.length ? await decide({
            title: 'The Pishach was blocked — who does it take instead?',
            detail: `${t.name} was warded. The Pishach still feeds tonight.`,
            about: t.name,
            options: pool.map(q => ({ id: q.id, value: q, label: q.name, hint: q.role })),
            auto: () => pick(pool),
            favour: side => {
              // helping good means taking someone whose loss costs them least
              const rank = q => (ROLES[q.role].kind === 'villager' && q.role !== FILLER) ? 2
                : ROLES[q.role].team === 'evil' ? 0 : 1;
              const sorted = [...pool].sort((a, b2) => side === 'good' ? rank(a) - rank(b2) : rank(b2) - rank(a));
              return sorted[0];
            },
          }) : null;
          if (alt) { alt.attacked = true; alt.alive = false; deaths.push(alt); tell(demon, `Still hungry, you took ${alt.name} instead.`); }
        }
      } else if (t.role === 'Ammamma' && !t.selfSaveUsed && !t.poisoned) {
        t.selfSaveUsed = true;
        tell(demon, `You went for ${t.name}. Something in that old woman would not let go.`);
        tell(t, 'Something came for you in the night. You are far too stubborn to die — this once.');
      } else {
        t.alive = false; deaths.push(t); tell(demon, `You devoured ${t.name}.`);
      }
    }
  }

  // 4b. Pehelwan drags an evil player into the light
  for (const d of deaths) {
    if (d.role === 'Pehelwan' && !d.poisoned) {
      const evils = seated().filter(q => q.alive && ROLES[q.role].team === 'evil');
      if (evils.length) game.pehelwanReveal = pick(evils).name;
    }
  }
  const death = deaths[0] || null;

  // How does the Aghori read tonight? Settled once so every power agrees.
  const aghori = seated().find(q => q.role === 'Aghori' && q.alive);
  if (aghori) {
    aghori.aghoriEvil = await decide({
      title: `How does the Aghori read tonight?`,
      detail: `${aghori.name} is good, but may register as evil. Every power that inspects them tonight gets this answer.`,
      about: aghori.name,
      options: [
        { id: 'evil', value: true, label: 'Reads EVIL', hint: 'throw suspicion onto a good player' },
        { id: 'good', value: false, label: 'Reads GOOD', hint: 'let them off the hook tonight' },
      ],
      auto: () => Math.random() < 0.5,
      // a false evil reading burns good's time; a clean one keeps their reads trustworthy
      favour: side => side === 'evil',
    });
  }

  // Ask the Storyteller what lie a poisoned or drunk player is fed.
  // `truth` lets the unseen storyteller lean: feeding the true answer is a harmless lie
  // that quietly helps good, feeding a wrong one sends the village hunting the innocent.
  const lie = (p, title, options, auto, truth) => decide({
    title,
    detail: `${p.name} is ${p.poisoned ? 'poisoned' : 'drunk'} — whatever you pick, they will believe it.`,
    about: p.name, options, auto,
    favour: side => {
      if (truth === undefined) return null;
      if (side === 'good') return truth;
      const wrong = options.filter(o => o.value !== truth);
      return wrong.length ? pick(wrong).value : null;
    },
  });
  const yesNo = (yes, no) => ([
    { id: 'y', value: true, label: yes }, { id: 'n', value: false, label: no },
  ]);
  const counts = n => Array.from({ length: n + 1 }, (_, i) => ({ id: String(i), value: i, label: String(i) }));
  const roleOpts = list => list.map(r => ({ id: r, value: r, label: r, hint: ROLES[r] && ROLES[r].kind }));
  // 4. info
  for (const p of seated().filter(p => p.alive)) {
    const shown = p.shownRole;
    const broken = p.poisoned || p.role === 'Old Monk'; // false info
    if (shown === 'Tarot Aunty' && game.nightActions[p.id]) {
      const t = byId(game.nightActions[p.id]);
      const evil = broken
        ? await lie(p, `What do the cards say about ${t.name}?`,
            yesNo('Tell them EVIL', 'Tell them GOOD'), () => Math.random() < 0.5, registersEvil(t))
        : registersEvil(t);
      tell(p, `The cards don't lie: ${t.name} is ${evil ? 'EVIL' : 'GOOD'}.`);
    }
    if (shown === 'Auto Anna') {
      const nb = neighboursOf(p);
      if (nb.length === 2) {
        const count = broken
          ? await lie(p, `How many evil neighbours does ${p.name} hear about?`,
              counts(2), () => Math.floor(Math.random() * 3), nb.filter(registersEvil).length)
          : nb.filter(registersEvil).length;
        tell(p, `Heard on the ride: among your living neighbours (${nb[0].name}, ${nb[1].name}), ${count} evil.`);
      }
    }
    if (shown === 'Night Owl' && firstNight) {
      const evils = seated().filter(q => q !== p && registersEvil(q));
      const goods = seated().filter(q => q !== p && !evils.includes(q));
      let pair;
      const honest = !broken && evils.length && goods.length;
      const candidates = honest
        ? evils.flatMap(e => goods.map(g => [e, g]))
        : shuffle(seated().filter(q => q !== p)).slice(0, 6).flatMap((a, i, arr) => arr.slice(i + 1).map(b => [a, b]));
      pair = candidates.length ? await decide({
        title: `Which pair does the Night Owl see?`,
        detail: honest
          ? `${p.name} learns that one of these two is evil — and it will be true.`
          : `${p.name} is ${p.poisoned ? 'poisoned' : 'drunk'}, so this pair need not contain anyone evil.`,
        about: p.name,
        options: shuffle(candidates).slice(0, 8).map(([a, b]) => ({
          id: a.id + '|' + b.id, value: [a, b],
          label: `${a.name} & ${b.name}`,
          hint: honest ? `${a.role} / ${b.role}` : 'a lie',
        })),
        auto: () => pick(candidates),
      }) : [];
      if (pair.length === 2) {
        const two = shuffle([...pair]);
        tell(p, `From your perch you saw something: one of ${two[0].name} and ${two[1].name} is evil.`);
      }
    }
    if (shown === 'Undertaker' && game.executedToday) {
      const ex = game.executedToday;
      const pool = inPlayish().filter(r => ROLES[r].kind !== 'demon');
      const role = broken
        ? await lie(p, `What role does the Undertaker find on ${ex.name}?`, roleOpts(pool.slice(0, 10)),
            () => pick(pool), registersAs(ex))
        : registersAs(ex);
      tell(p, `You laid ${ex.name} to rest: they were the ${role}.`);
    }
    if (shown === 'Sapnewali' && game.nightActions[p.id]) {
      const t = byId(game.nightActions[p.id]);
      const truth = broken
        ? await lie(p, `The dream of ${t.name} is false — which role is the "true" one?`,
            roleOpts(inPlayish().slice(0, 10)), () => pick(inPlayish()))
        : registersAs(t);
      const decoyPool = inPlayish().filter(r => r !== truth);
      const decoy = decoyPool.length ? await decide({
        title: `Pair a decoy role with ${truth}`,
        detail: `${p.name} dreamt of ${t.name} and will be told it is one of these two.`,
        about: p.name,
        options: roleOpts(shuffle(decoyPool).slice(0, 8)),
        auto: () => pick(decoyPool),
      }) : truth;
      const two = shuffle([truth, decoy]);
      tell(p, `You dreamt of ${t.name}. They are one of these: ${two[0]} or ${two[1]}.`);
    }
    if (shown === 'Guru') {
      const nb = neighboursOf(p);
      if (nb.length === 2) {
        const same = broken
          ? await lie(p, `Are ${nb[0].name} and ${nb[1].name} on the same team?`,
              yesNo('Say SAME team', 'Say DIFFERENT teams'), () => Math.random() < 0.5,
              registersEvil(nb[0]) === registersEvil(nb[1]))
          : (registersEvil(nb[0]) === registersEvil(nb[1]));
        tell(p, `You sat with it: ${nb[0].name} and ${nb[1].name} are ${same ? 'on the SAME team' : 'on DIFFERENT teams'}.`);
      }
    }
    if (shown === 'Kavi') {
      const sc = scriptOf();
      const all = [...sc.villagers, ...sc.outsiders, ...sc.minions];
      const notInPlay = all.filter(r => !seated().some(q => q.role === r));
      const pool = broken ? all : notInPlay;
      const line = pool.length ? await decide({
        title: `Which role does the Kavi name as absent?`,
        detail: broken
          ? `${p.name} is ${p.poisoned ? 'poisoned' : 'drunk'} — this may name a role that IS in play.`
          : `Truthfully absent from this game. Pick the one that misleads best.`,
        about: p.name,
        options: roleOpts(shuffle([...pool]).slice(0, 10)),
        auto: () => pick(pool),
      }) : null;
      if (line) tell(p, `Your verse names a role that never came to this society: the ${line}.`);
      else tell(p, 'You reach for a verse tonight and find every role already walks among you.');
    }
    if (shown === 'Traffic Cop' && game.nightActions[p.id]) {
      const t = byId(game.nightActions[p.id]);
      const hit = broken
        ? await lie(p, `Was ${t.name} attacked tonight?`, yesNo('Say ATTACKED', 'Say quiet'),
            () => Math.random() < 0.5, t.attacked)
        : t.attacked;
      tell(p, `You kept an eye on ${t.name}: ${hit ? 'something ATTACKED them tonight.' : 'their night was quiet.'}`);
    }
    if (shown === 'Secretary') {
      const evilVoters = game.todayYesVoters
        .map(byId).filter(q => q && ROLES[q.role].team === 'evil').length;
      const count = broken
        ? await lie(p, `How many evil voters do the minutes show?`, counts(3),
            () => Math.floor(Math.random() * 3), evilVoters)
        : evilVoters;
      tell(p, `You read back the minutes: ${count} evil player(s) voted to cast someone out today.`);
    }
    if (shown === 'Auditor' && game.nightActions[p.id]) {
      const t = byId(game.nightActions[p.id]);
      const count = broken
        ? await lie(p, `What does the ledger say about ${t.name}?`, counts(4),
            () => Math.floor(Math.random() * 4), t.yesVotes)
        : t.yesVotes;
      tell(p, `The ledger on ${t.name}: they have voted to cast someone out ${count} time(s).`);
    }
    if (p.role === 'WhatsApp Admin') {
      const goods = seated().filter(q => q.alive && ROLES[q.role].team === 'good');
      if (goods.length) {
        const t = pick(goods);
        tell(p, `Forwarded as received: ${t.name} is the ${t.role}.`);
      }
    }
  }
  game.executedToday = null;
  // dawn
  game.dayNum++;
  game.phase = 'day';
  game.onBlock = null; game.onBlockVotes = 0; game.nomination = null;
  game.todayYesVoters = [];
  for (const p of seated()) { p.nominatedToday = false; p.wasNominatedToday = false; }
  if (deaths.length > 1) {
    const names = deaths.map(d => d.name).join(' and ');
    log(`Dawn, Day ${game.dayNum}. ${names} were found dead. The society is in open panic.`);
    headline('death', `${names} are dead`, 'Two of you did not wake up. Whatever is in this society is not being careful any more.');
  } else if (death) {
    log(`Dawn, Day ${game.dayNum}. ${death.name} was found dead. An emergency society meeting is called.`);
    headline('death', `${death.name} is dead`, 'Found in the night. Nobody heard a thing — or nobody is saying so.');
  } else {
    log(`Dawn, Day ${game.dayNum}. By some miracle, nobody died. The society meeting gathers.`);
    headline('quiet', 'Nobody died last night', 'Everyone is still here. Somebody was protected, or something chose not to feed.');
  }
  if (game.pehelwanReveal) {
    log(`The Pehelwan went down fighting and dragged someone into the light: ${game.pehelwanReveal} is EVIL.`);
    game.pehelwanReveal = null;
  }
  if (!checkWin()) { maybeOfferDefection(); broadcast(); }
}

// ---------------------------------------------------------------- day: nominations & voting
function nominate(p, targetId) {
  if (game.phase !== 'day' || game.nomination || !p.alive || p.nominatedToday) return;
  const t = byId(targetId);
  if (!t || !t.alive || t.wasNominatedToday) return;
  p.nominatedToday = true;
  t.wasNominatedToday = true;
  const eligible = seated().filter(q => q.alive || q.ghostVote).map(q => q.id);
  game.nomination = { nominatorId: p.id, nomineeId: t.id, votes: {}, eligible };
  log(`${p.name} accuses ${t.name} in the society meeting. Votes needed to endanger: ${Math.ceil(alive().length / 2)}.`);
  broadcast();
}

function castVote(p, yes) {
  const n = game.nomination;
  if (!n || !n.eligible.includes(p.id) || p.id in n.votes) return;
  yes = !!yes;
  // Chamcha cannot bring themselves to say no
  if (p.role === 'Chamcha' && p.alive && !p.poisoned) yes = true;
  n.votes[p.id] = yes;
  if (yes) {
    p.yesVotes = (p.yesVotes || 0) + 1;
    if (!game.todayYesVoters.includes(p.id)) game.todayYesVoters.push(p.id);
  }
  if (Object.keys(n.votes).length === n.eligible.length) closeNomination();
  else broadcast();
}

function closeNomination() {
  const n = game.nomination;
  if (!n) return;
  // Broker: a bought vote counts for nothing today
  const counts = id => byId(id).voteBlockedDay !== game.dayNum;
  const yes = Object.entries(n.votes).filter(([id, v]) => v && counts(id));
  // dead voters spend their ghost vote only on a YES
  for (const [id, v] of Object.entries(n.votes)) {
    const q = byId(id);
    if (v && !q.alive) q.ghostVote = false;
  }
  let tally = yes.length;
  // Landlord: a living, unpoisoned Landlord's YES counts twice (secretly)
  for (const [id] of yes) {
    const q = byId(id);
    if (q.alive && q.role === 'Landlord' && !q.poisoned) tally++;
  }
  const need = Math.ceil(alive().length / 2);
  const nominee = byId(n.nomineeId);
  const voters = yes.map(([id]) => byId(id).name).join(', ') || 'nobody';
  if (tally >= need && tally > game.onBlockVotes) {
    game.onBlock = nominee.id; game.onBlockVotes = tally;
    log(`${nominee.name} got ${tally} votes (hands raised: ${voters}) — they are ON THE BLOCK.`);
  } else if (tally >= need && tally === game.onBlockVotes && game.onBlock) {
    game.onBlock = null;
    log(`${nominee.name} got ${tally} votes (hands raised: ${voters}) — a tie! Nobody is on the block now.`);
  } else if (tally >= need) {
    log(`${nominee.name} got ${tally} votes (hands raised: ${voters}) — not enough to beat the current block (${game.onBlockVotes}).`);
  } else {
    log(`${nominee.name} got ${tally} votes (hands raised: ${voters}) — not enough (${need} needed).`);
  }
  game.nomination = null;
  broadcast();
}

function hunterShot(p, targetId) {
  if (game.phase !== 'day' || !p.alive || p.shownRole !== 'Slayer' || p.hunterUsed) return;
  const t = byId(targetId);
  if (!t || !t.alive) return;
  p.hunterUsed = true;
  const works = p.role === 'Slayer' && !p.poisoned && isDemon(t);
  if (works) {
    t.alive = false;
    log(`${p.name} the Slayer strikes ${t.name}... and the ${t.role.toUpperCase()} falls, shrieking!`);
    if (checkWin()) return;
  } else {
    log(`${p.name} claims to be the Slayer and strikes ${t.name}... nothing happens. Awkward.`);
  }
  broadcast();
}

function endDay(p) {
  if (game.phase !== 'day' || !p.host) return;
  if (game.nomination) closeNomination();
  if (game.phase !== 'day') return;
  const blocked = game.onBlock ? byId(game.onBlock) : null;
  if (blocked && blocked.alive) {
    // Netaji talks their way out of the first eviction
    if (blocked.role === 'Netaji' && !blocked.executionSurvived && !blocked.poisoned) {
      blocked.executionSurvived = true;
      log(`Dusk. The society votes ${blocked.name} out — and somehow, by morning, the paperwork is lost. They stay.`);
      headline('spared', `${blocked.name} stays`, 'The society voted them out. By morning the paperwork had gone missing and nobody can explain it.');
      startNight();
      return;
    }
    blocked.alive = false;
    game.executedToday = blocked;
    log(`Dusk. The society evicts ${blocked.name}. Deposit forfeited. Never to return.`);
    headline('cast-out', `${blocked.name} is cast out`, `The society voted, ${game.onBlockVotes} hands went up, and their role dies with them.`);
    if (blocked.role === 'Kasai' && !blocked.poisoned) {
      game.doubleKill = true;
      log('Something in the way the butcher smiled on the way out was deeply unsettling.');
    }
    if (checkWin()) return;
  } else {
    log('Dusk. The society evicts nobody today.');
    headline('quiet', 'Nobody is cast out', 'The society could not agree, or chose not to. Night falls with everyone still in it.');
    const mayor = seated().find(q => q.role === 'Big Boss' && q.alive && !q.poisoned);
    if (alive().length === 3 && mayor) {
      return gameOver('good', `Only three remained, nobody was cast out, and ${mayor.name} was the Big Boss. The society holds together — GOOD wins!`);
    }
  }
  startNight();
}

// ---------------------------------------------------------------- win conditions
function checkWin() {
  const demon = seated().find(p => p.role && isDemon(p));
  if (!demon || !demon.alive) {
    gameOver('good', `The ${demon ? demon.role : 'demon'} is dead. The sun rises over the society — GOOD wins!`);
    return true;
  }
  const liv = alive();
  const evilAlive = liv.filter(p => ROLES[p.role].team === 'evil').length;
  if (liv.length <= 2 || evilAlive >= liv.length - evilAlive) {
    gameOver('evil', `The society belongs to the ${demon.role} now. EVIL wins!`);
    return true;
  }
  return false;
}

function gameOver(winner, reason) {
  game.phase = 'over';
  game.winner = winner;
  game.winReason = reason;
  log(reason);
  log('The truth: ' + seated().map(p => `${p.name} = ${p.role}${p.role !== p.shownRole ? ` (believed ${p.shownRole})` : ''}`).join(' · '));
  broadcast();
}

// ---------------------------------------------------------------- ws plumbing
const fail = (ws, text) => ws.send(JSON.stringify({ type: 'error', text }));

// Put someone back in the chair they already own.
function reseat(p, ws) {
  if (p.ws && p.ws !== ws && p.ws.readyState === 1) { try { p.ws.close(); } catch {} }
  p.ws = ws;
  p.goneAt = null;
  sockets.set(ws, { playerId: p.id, code: game.code });
  game.lastSeen = Date.now();
  // The Storyteller runs the game; if the controls were auto-handed to someone else
  // while their phone was dark, give them straight back.
  if (p.storyteller && !p.host) {
    const holder = game.players.find(q => q.host);
    if (!holder || holder.hostAuto) {
      game.players.forEach(q => { q.host = false; q.hostAuto = false; });
      p.host = true;
    }
  }
}

// Someone is gone — either they tapped Leave, or their socket dropped. Never leave the
// room unable to continue: free any judgement call they were holding and pass on the
// host controls. `permanent` also takes their seat out of the game entirely.
// A dropped socket is almost always a phone locking, a lift, or a two-second network
// blip — NOT someone leaving. So a disconnect never costs you your seat. We only note
// when you went quiet; reapAbsent() below deals with people who are genuinely gone.
function releaseSeat(p, permanent) {
  if (permanent) {
    game.players = game.players.filter(q => q.id !== p.id);
    game.players.forEach((q, i) => { q.seat = i; });
    if (game.players.length && !game.players.some(q => q.host)) game.players[0].host = true;
    if (game.phase !== 'lobby' && game.phase !== 'over') log(`${p.name} left the game.`);
  } else {
    p.goneAt = Date.now();
  }
  // an open judgement call must never wait on a phone that has gone dark
  if (p.storyteller && game.pendingDecision) {
    const d = game.pendingDecision;
    game.pendingDecision = null;
    log('The Storyteller stepped away; the game decided that one itself.');
    d.resolve(d.auto());
  }
  if (!game.players.length) rooms.delete(game.code);
}

const HOST_GRACE = 45 * 1000;    // how long a host may be offline before someone takes over
const LOBBY_GRACE = 3 * 60 * 1000; // how long a lobby seat is held for someone who never returns

function reapAbsent() {
  for (const g of rooms.values()) {
    useRoom(g);
    const now = Date.now();
    const connected = q => !!(q.ws && q.ws.readyState === 1);
    let changed = false;

    // hand over the controls only if the host has really gone, not for a blip
    const host = game.players.find(q => q.host);
    if (host && !connected(host) && now - (host.goneAt || 0) > HOST_GRACE) {
      const heir = game.players.find(q => q !== host && connected(q));
      if (heir) {
        host.host = false; heir.host = true; heir.hostAuto = true;
        log(`${host.name} has been offline a while. ${heir.name} is running the game.`);
        changed = true;
      }
    }
    // in the lobby, free seats held by people who never came back
    if (game.phase === 'lobby') {
      const stale = game.players.filter(q => !connected(q) && q.goneAt && now - q.goneAt > LOBBY_GRACE);
      if (stale.length) {
        game.players = game.players.filter(q => !stale.includes(q));
        game.players.forEach((q, i) => { q.seat = i; });
        if (game.players.length && !game.players.some(q => q.host)) game.players[0].host = true;
        changed = true;
      }
    }
    if (!game.players.length) rooms.delete(g.code);
    else if (changed) broadcast();
  }
}
setInterval(reapAbsent, 15000).unref();

function handleMessage(ws, raw) {
  let msg; try { msg = JSON.parse(raw); } catch { return; }
  const bind = sockets.get(ws);

  if (msg.type === 'join') {
    // Rejoining: the token alone identifies both the room and the seat.
    if (msg.token) {
      for (const g of rooms.values()) {
        const existing = g.players.find(q => q.token === msg.token);
        if (existing) {
          useRoom(g);
          reseat(existing, ws);
          ws.send(JSON.stringify({ type: 'joined', token: existing.token, id: existing.id, code: g.code }));
          broadcast();
          return;
        }
      }
      // Token is stale: the server restarted, or the room was reclaimed. Tell the client
      // to forget it and start over, rather than leaving them on a frozen screen.
      if (!msg.name) {
        ws.send(JSON.stringify({ type: 'left' }));
        ws.send(JSON.stringify({ type: 'error', text: 'That game has finished. Start a new one, or join with a code.' }));
        return;
      }
    }

    const name = String(msg.name || '').trim().slice(0, 16);
    if (!name) return;

    let g;
    if (msg.create) {
      g = createRoom();
    } else {
      const code = String(msg.code || '').trim().toUpperCase();
      if (!code) return fail(ws, 'Enter a room code, or start a new game.');
      g = rooms.get(code);
      if (!g) return fail(ws, `No game called ${code}. Check the code, or start a new one.`);
    }
    useRoom(g);

    // Someone typing their own name back in after being bounced should get their seat
    // back — including mid-game — rather than being told the name is taken by their ghost.
    const sameName = game.players.find(q => q.name.toLowerCase() === name.toLowerCase());
    if (sameName) {
      if (sameName.ws && sameName.ws.readyState === 1) return fail(ws, 'Someone in this room already has that name.');
      reseat(sameName, ws);
      ws.send(JSON.stringify({ type: 'joined', token: sameName.token, id: sameName.id, code: game.code }));
      broadcast();
      return;
    }

    // new players may join in the lobby, or after a game ends (they'll be in the next one)
    if (game.phase !== 'lobby' && game.phase !== 'over') return fail(ws, 'That game is already under way — wait for the next round.');
    if (seated().length >= MAX_PLAYERS) return fail(ws, `That room is full (${MAX_PLAYERS} max).`);

    const np = {
      id: crypto.randomUUID(), token: crypto.randomUUID(), name, ws,
      seat: game.players.length, host: game.players.length === 0,
      alive: true, ghostVote: true, role: null, shownRole: null, inbox: [],
      poisoned: false, protected: false, hunterUsed: false, nominatedToday: false, wasNominatedToday: false,
    };
    game.players.push(np);
    sockets.set(ws, { playerId: np.id, code: game.code });
    game.lastSeen = Date.now();
    ws.send(JSON.stringify({ type: 'joined', token: np.token, id: np.id, code: game.code }));
    broadcast();
    return;
  }

  if (!bind) return;
  const room = rooms.get(bind.code);
  if (!room) {
    // the room went away under them — send them back to the front door, don't freeze
    sockets.delete(ws);
    ws.send(JSON.stringify({ type: 'left' }));
    ws.send(JSON.stringify({ type: 'error', text: 'That room is no longer open.' }));
    return;
  }
  useRoom(room);
  game.lastSeen = Date.now();
  const p = byId(bind.playerId);
  if (!p) return;

  if (msg.type === 'leave') {
    // Walk out of the room entirely and go back to the front door.
    sockets.delete(ws);
    p.ws = null;
    releaseSeat(p, true);
    ws.send(JSON.stringify({ type: 'left' }));
    broadcast();
    return;
  }
  switch (msg.type) {
    case 'start':
      if (p.host && game.phase === 'lobby' && SETUP[seated().length]) startGame();
      break;
    case 'setScript':
      if (p.host && game.phase === 'lobby' && SCRIPTS[msg.id]) { game.scriptId = msg.id; broadcast(); }
      break;
    case 'makeHost': {
      // hand the controls to someone else — "you run this one"
      if (!p.host) break;
      const t = byId(msg.target);
      if (!t || t === p || !(t.ws && t.ws.readyState === 1)) break;
      p.host = false; t.host = true;
      if (p.storyteller) { p.storyteller = false; }   // the chair goes with the crown
      log(`${t.name} is running the game now.`);
      broadcast();
      break;
    }
    case 'setStoryteller':
      // Only the host may take or drop the Storyteller chair, and only in the lobby.
      if (p.host && game.phase === 'lobby') {
        game.players.forEach(q => { q.storyteller = false; });
        if (msg.on) p.storyteller = true;
        game.players.forEach((q, i) => { q.seat = i; });
        broadcast();
      }
      break;
    case 'setDirector':
      if (p.host && game.phase === 'lobby') { game.director = !!msg.on; broadcast(); }
      break;
    case 'decision':
      answerDecision(p, msg.option);
      break;
    case 'offer':
      answerOffer(p, !!msg.accept);
      break;
    case 'stTwist': {
      // Storyteller-driven versions of the same twists.
      if (!p.storyteller || game.phase === 'lobby') break;
      const t = byId(msg.target);
      if (!t || t.storyteller || !t.role) break;
      if (msg.action === 'changeRole' && ROLES[msg.role]) changeRole(t, msg.role);
      else if (msg.action === 'offer' && !game.pendingOffer) {
        offerDefection(t, ROLES[t.role].team === 'good' ? 'evil' : 'good');
      }
      broadcast();
      break;
    }
    case 'stAction': {
      // Direct levers, for when one side is running away with it.
      if (!p.storyteller || game.phase === 'lobby') break;
      const t = byId(msg.target);
      if (!t || t.storyteller) break;
      if (msg.action === 'poison') {
        t.stPoisoned = !t.stPoisoned;
        t.poisoned = t.stPoisoned || t.poisoned;
        log(t.stPoisoned ? `Something has gone wrong for ${t.name}.` : `${t.name} feels clear-headed again.`);
      } else if (msg.action === 'kill' && t.alive) {
        t.alive = false;
        log(`${t.name} is dead.`);
        if (checkWin()) return;
      } else if (msg.action === 'revive' && !t.alive) {
        t.alive = true;
        log(`${t.name} is somehow, impossibly, alive again.`);
      } else if (msg.action === 'ghost') {
        t.ghostVote = true;
        tell(t, 'Your ghost vote has been restored.');
      }
      broadcast();
      break;
    }
    case 'stMessage': {
      if (!p.storyteller) break;
      const t = byId(msg.target);
      const text = String(msg.text || '').trim().slice(0, 240);
      if (!t || t.storyteller || !text) break;
      tell(t, text);
      broadcast();
      break;
    }
    case 'nightAction': submitNightAction(p, msg.target); break;
    case 'nominate': nominate(p, msg.target); break;
    case 'vote': castVote(p, msg.yes); break;
    case 'shoot': hunterShot(p, msg.target); break;
    case 'endDay': endDay(p); break;
    case 'closeNomination': if (p.host) closeNomination(); break;
    case 'newGame':
      if (p.host && (game.phase === 'over' || game.phase === 'lobby')) {
        // drop anyone who has disconnected between games
        const code = game.code;
        const keep = game.players.filter(q => q.ws && q.ws.readyState === 1).map(q => ({
          ...q, alive: true, ghostVote: true, role: null, shownRole: null, inbox: [],
          poisoned: false, stPoisoned: false, hunterUsed: false, nominatedToday: false,
          wasNominatedToday: false, selfSaveUsed: false, lastWard: null, yesVotes: 0,
          voteBlockedDay: -1, executionSurvived: false, registerAs: null, aghoriEvil: null,
          nightPrompt: null, nightDecoy: false,
        }));
        game = freshGame();
        game.code = code;
        game.createdAt = Date.now();
        game.lastSeen = Date.now();
        game.players = keep;
        game.players.forEach((q, i) => { q.seat = i; });
        if (game.players.length && !game.players.some(q => q.host)) game.players[0].host = true;
        // the room must point at the NEW game, or every later message lands on the dead one
        rooms.set(code, game);
        broadcast();
      }
      break;
  }
}

// ---------------------------------------------------------------- http
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json',
};
const server = http.createServer((req, res) => {
  let file = req.url.split('?')[0];
  // hosting platforms ping this to know the service is up
  if (file === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true, rooms: rooms.size,
      players: [...rooms.values()].reduce((n, g) => n + g.players.length, 0),
    }));
    return;
  }
  if (file.endsWith('/')) file += 'index.html';
  const fp = path.join(__dirname, 'public', path.normalize(file).replace(/^([.][.][/\\])+/, ''));
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    // Fonts and icons never change under a given name, so cache them hard. The game code
    // must always be revalidated: after a redeploy a stale client.js on someone's phone
    // would be talking to a newer server.
    const longLived = /^\/(vendor\/fonts|icon)/.test(file) || /\.(woff2|woff|ttf|png)$/.test(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream',
      // no-store, not no-cache: phones were holding on to old copies of the game code
      // after a redeploy and running it against a newer server.
      'Cache-Control': longLived ? 'public, max-age=31536000, immutable' : 'no-store, max-age=0',
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
wss.on('connection', ws => {
  ws.missedPongs = 0;
  ws.on('pong', () => { ws.missedPongs = 0; });
  // the client needs the cast before it has joined anything, for the tutorial
  ws.send(JSON.stringify({
    type: 'hello', scripts: scriptCatalogue(),
    minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS,
  }));
  ws.on('message', raw => handleMessage(ws, raw));
  ws.on('close', () => {
    const bind = sockets.get(ws);
    sockets.delete(ws);
    if (!bind) return;
    const room = rooms.get(bind.code);
    if (!room) return;
    useRoom(room);
    const p = byId(bind.playerId);
    if (p && p.ws === ws) {
      p.ws = null;
      releaseSeat(p, false);   // seat is kept mid-game so they can reconnect
      broadcast();
    }
  });
});

// A long day-phase argument is minutes of silence. Without traffic, hosting proxies drop
// the socket and free tiers spin the service down mid-game — so keep the line warm.
// Phones miss pongs constantly — locked screens, lifts, app switches. Terminating on the
// first miss was cutting people off mid-game, so allow three (~90s) before giving up.
setInterval(() => {
  for (const ws of wss.clients) {
    ws.missedPongs = (ws.missedPongs || 0) + 1;
    if (ws.missedPongs > 3) { ws.terminate(); continue; }
    try { ws.ping(); } catch { /* already closing */ }
  }
}, 30000).unref();

server.listen(PORT, () => {
  const nets = require('os').networkInterfaces();
  const ips = Object.values(nets).flat().filter(n => n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log(`AMAVAS running.`);
  console.log(`  On this computer: http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  On phones (same WiFi): http://${ip}:${PORT}`);
});
