// AMAVAS game data — the single source of truth for roles and story modes.
// Required by server.js and by make-cast-page.js, so the rulebook can never drift from the game.

const ROLES = {
  // good — residents
  'Tarot Aunty':    { team: 'good', kind: 'villager', icon: '🔮', blurb: 'Each night, pull a card on one player: the cards say GOOD or EVIL.' },
  'Exorcist':       { team: 'good', kind: 'villager', icon: '🕯️', blurb: 'Each night, ward one player against the Rakshasa. It cannot touch them tonight.' },
  'Auto Anna':      { team: 'good', kind: 'villager', icon: '🛺', blurb: 'You ferry everyone and hear everything. Each night, learn how many of your two living neighbours are evil.' },
  'Undertaker':     { team: 'good', kind: 'villager', icon: '🪦', blurb: 'Each night, learn the true role of whoever was cast out today.' },
  'Slayer':         { team: 'good', kind: 'villager', icon: '🗡️', blurb: 'Once per game, during the day, publicly strike a player. If it\'s the Rakshasa, it dies. One strike only.' },
  'Big Boss':       { team: 'good', kind: 'villager', icon: '😎', blurb: 'If only 3 players remain and nobody is cast out today, GOOD wins.' },
  'Night Owl':      { team: 'good', kind: 'villager', icon: '🦉', blurb: 'First night only: from your perch you spot two players — one of them is evil.' },
  'Aam Aadmi':      { team: 'good', kind: 'villager', icon: '🧢', blurb: 'The common man. No powers — just vibes, arguments, and one vote.' },
  // good — outsiders
  'Old Monk':       { team: 'good', kind: 'outsider', icon: '🥃', blurb: 'Far too much Old Monk. You are CONVINCED you have a power. You do not. All your "information" is nonsense.' },
  'Aghori':         { team: 'good', kind: 'outsider', icon: '🔱', blurb: 'A fearsome ascetic. You are good, but you may register as EVIL to powers. Expect suspicion.' },
  // evil — minions
  'Vishkanya':      { team: 'evil', kind: 'minion', icon: '🐍', blurb: 'The poison maiden. Each night, poison a player: their power fails or lies until dusk.' },
  'Influencer':     { team: 'evil', kind: 'minion', icon: '🤳', blurb: 'Your image is curated. You register as GOOD to powers. Bluff shamelessly.' },
  'WhatsApp Admin': { team: 'evil', kind: 'minion', icon: '📱', blurb: 'Admin of the society group. Each night, the group chat reveals the true role of one good player.' },
  'Landlord':       { team: 'evil', kind: 'minion', icon: '🔑', blurb: 'Ten months deposit, no refunds. When you vote to cast someone out, your vote secretly counts twice.' },
  // demon
  'Rakshasa':       { team: 'evil', kind: 'demon', icon: '👹', blurb: 'The demon of the moonless night. Each night (except the first), choose a resident to devour.' },

  // ===== MONSOON BLOOD — the rains came and the nights turned deadly =====
  'Ammamma':        { team: 'good', kind: 'villager', icon: '🧕', blurb: 'Grandmother, and far too stubborn to die. The first time you are attacked at night, you survive it.' },
  'Pehelwan':       { team: 'good', kind: 'villager', icon: '🤼', blurb: 'The wrestler. If you are killed at night, you drag one evil player into the light — they are named publicly at dawn.' },
  'Traffic Cop':    { team: 'good', kind: 'villager', icon: '🚦', blurb: 'Each night, choose a player: learn whether anything attacked them tonight.' },
  'Sadhu':          { team: 'good', kind: 'villager', icon: '🙏', blurb: 'Each night, ward a player against death. But ward the same person two nights running and your blessing curdles — they die.' },
  'Tantrik':        { team: 'evil', kind: 'minion',   icon: '🕯', blurb: 'Each night, choose a player: every ward and blessing protecting them fails tonight.' },
  'Kasai':          { team: 'evil', kind: 'minion',   icon: '🔪', blurb: 'The butcher. If the society casts you out, the demon feeds twice the following night.' },
  'Pishach':        { team: 'evil', kind: 'demon',    icon: '🩸', blurb: 'A relentless hunger. Each night (except the first), devour a resident — and if something stops you, you take someone else at random instead.' },

  // ===== MAYA — nothing you are told is safe =====
  'Sapnewali':      { team: 'good', kind: 'villager', icon: '💤', blurb: 'The dream-reader. Each night, choose a player: you learn two roles, and one of them is truly theirs.' },
  'Guru':           { team: 'good', kind: 'villager', icon: '🧘', blurb: 'Each night, learn whether your two living neighbours are on the same team as each other.' },
  'Kavi':           { team: 'good', kind: 'villager', icon: '📜', blurb: 'The poet writes only of what never was. Each night, learn one role that is NOT in play.' },
  'Pagal':          { team: 'good', kind: 'outsider', icon: '🤪', blurb: 'You are certain you are the demon. You are not. You are good, and you kill nobody.' },
  'Naqab':          { team: 'evil', kind: 'minion',   icon: '🎭', blurb: 'The mask. Each night, choose a player: to every power in the society, tonight they read as the demon itself.' },
  'Chhaya':         { team: 'evil', kind: 'demon',    icon: '🌑', blurb: 'The shadow. Each night (except the first), devour a resident. Every power that inspects you says you are GOOD.' },

  // ===== SOCIETY AGM — the politics of the vote =====
  'Secretary':      { team: 'good', kind: 'villager', icon: '🗂', blurb: 'You keep the minutes. Each night, learn how many evil players voted to cast someone out today.' },
  'Auditor':        { team: 'good', kind: 'villager', icon: '🧾', blurb: 'Each night, choose a player: learn how many times they have voted to cast someone out this game.' },
  'Chamcha':        { team: 'good', kind: 'outsider', icon: '🥄', blurb: 'The yes-man. You are good, but you cannot help yourself — your vote is always counted as YES, whatever you press.' },
  'Broker':         { team: 'evil', kind: 'minion',   icon: '💼', blurb: 'Each night, choose a player: their vote is bought and counts for nothing tomorrow.' },
  'Netaji':         { team: 'evil', kind: 'demon',    icon: '🎖', blurb: 'The politician. Each night (except the first), devour a resident. The first time the society casts you out, you survive it.' },
};

// ---------------------------------------------------------------- story modes
const SCRIPTS = {
  amavas: {
    name: 'Amavas',
    tag: 'The moonless night',
    blurb: 'The starter edition. Clean information, one killer, no tricks — the best place to learn the game.',
    difficulty: 'Starter',
    villagers: ['Tarot Aunty', 'Exorcist', 'Auto Anna', 'Undertaker', 'Slayer', 'Big Boss', 'Night Owl'],
    outsiders: ['Old Monk', 'Aghori'],
    minions: ['Vishkanya', 'Influencer', 'WhatsApp Admin', 'Landlord'],
    demon: 'Rakshasa',
  },
  monsoon: {
    name: 'Monsoon Blood',
    tag: 'The rains brought something with them',
    blurb: 'Deadly nights. Protection is everything, wards can be broken, and the dead do not go quietly. Good must survive as much as deduce.',
    difficulty: 'Bloody',
    villagers: ['Ammamma', 'Pehelwan', 'Traffic Cop', 'Sadhu', 'Exorcist', 'Undertaker', 'Big Boss', 'Night Owl'],
    outsiders: ['Old Monk', 'Aghori'],
    minions: ['Tantrik', 'Kasai', 'Landlord', 'Influencer'],
    demon: 'Pishach',
  },
  maya: {
    name: 'Maya',
    tag: 'Nothing you are told is safe',
    blurb: 'Information lies. Roles wear each other\'s faces, the demon reads as good, and one of you is loudly, sincerely wrong about everything.',
    difficulty: 'Twisted',
    villagers: ['Sapnewali', 'Guru', 'Kavi', 'Tarot Aunty', 'Night Owl', 'Undertaker', 'Slayer', 'Big Boss'],
    outsiders: ['Pagal', 'Aghori'],
    minions: ['Naqab', 'Vishkanya', 'Influencer', 'WhatsApp Admin'],
    demon: 'Chhaya',
  },
  agm: {
    name: 'Society AGM',
    tag: 'Politics, minutes and a body',
    blurb: 'The game is won and lost at the vote. Track who raises their hand, buy the ones who matter, and remember the demon has friends on the committee.',
    difficulty: 'Political',
    villagers: ['Secretary', 'Auditor', 'Auto Anna', 'Tarot Aunty', 'Exorcist', 'Slayer', 'Big Boss', 'Undertaker'],
    outsiders: ['Chamcha', 'Old Monk'],
    minions: ['Broker', 'Landlord', 'WhatsApp Admin', 'Influencer'],
    demon: 'Netaji',
  },
};
const FILLER = 'Aam Aadmi';

module.exports = { ROLES, SCRIPTS, FILLER };

