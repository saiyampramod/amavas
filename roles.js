// AMAVAS game data — the single source of truth for roles and story modes.
// Required by server.js and by make-cast-page.js, so the rulebook can never drift from the game.

const ROLES = {
  // good — residents
  'Tarot Aunty':    { team: 'good', kind: 'villager', icon: '🔮', blurb: 'Each night, pull a card on one player: the cards say GOOD or EVIL.', how: "A GOOD read is worth little. An EVIL read is a lead worth dying on. Read the quiet players — the loud ones get read by everyone else. If you are poisoned nobody tells you, so try to hold two reads before you accuse anyone." },
  'Exorcist':       { team: 'good', kind: 'villager', icon: '🕯️', blurb: 'Each night, ward one player against the Rakshasa. It cannot touch them tonight.', how: "Guard whoever just claimed a strong role, because the demon heard them too. Never guard the same person every night: a demon that suddenly stops killing has worked out who you are protecting. You cannot guard yourself." },
  'Auto Anna':      { team: 'good', kind: 'villager', icon: '🛺', blurb: 'You ferry everyone and hear everything. Each night, learn how many of your two living neighbours are evil.', how: "Your number is about the two people either side of you in the roster, and it shifts as players die. Two nights of zero means evil is elsewhere. A sudden 1 means one of your new neighbours just became a problem." },
  'Undertaker':     { team: 'good', kind: 'villager', icon: '🪦', blurb: 'Each night, learn the true role of whoever was cast out today.', how: "You only learn something on a night after an execution, so a day with no execution wastes you entirely. If the village kills someone you can prove was good, say so before they burn another day." },
  'Slayer':         { team: 'good', kind: 'villager', icon: '🗡️', blurb: 'Once per game, during the day, publicly strike a player. If it\'s the Rakshasa, it dies. One strike only.', how: "One shot, in public, and everyone watches it fail. Do not fire on day one. Fire when someone is a vote away from execution and you disagree, or when a demon claim needs testing on the spot." },
  'Big Boss':       { team: 'good', kind: 'villager', icon: '😎', blurb: 'If only 3 players remain and nobody is cast out today, GOOD wins.', how: "Your win needs exactly 3 alive and nobody executed that day — so the village has to know before that day arrives. Claim too early and you are eaten; claim too late and they execute someone from habit and throw it away." },
  'Night Owl':      { team: 'good', kind: 'villager', icon: '🦉', blurb: 'First night only: from your perch you spot two players — one of them is evil.', how: "You learn once, on the first night, and it is true. That is a clean 50/50 you can hand the village on day one — but the moment you say it, the demon knows exactly who to silence." },
  'Aam Aadmi':      { team: 'good', kind: 'villager', icon: '🧢', blurb: 'The common man. No powers — just vibes, arguments, and one vote.', how: "No power, which is itself information: one good slot is spent on nothing. Your job is to listen, cross-check the claims against each other, and be the vote people have to actually argue for." },
  // good — outsiders
  'Old Monk':       { team: 'good', kind: 'outsider', icon: '🥃', blurb: 'Far too much Old Monk. You are CONVINCED you have a power. You do not. All your "information" is nonsense.', how: "The app will tell you that you are a completely different role, and it will never correct itself. Every result you get is invented. If your information keeps contradicting everyone else, consider that you are the reason." },
  'Aghori':         { team: 'good', kind: 'outsider', icon: '🔱', blurb: 'A fearsome ascetic. You are good, but you may register as EVIL to powers. Expect suspicion.', how: "You are good, but on some nights you read as EVIL and you are never told which. Expect to be accused on somebody's perfectly honest read. Claiming Aghori early is often the only thing that saves you." },
  // evil — minions
  'Vishkanya':      { team: 'evil', kind: 'minion', icon: '🐍', blurb: 'The poison maiden. Each night, poison a player: their power fails or lies until dusk.', how: "Poison the loudest claimed power, not the demon's next meal. A poisoned Tarot Aunty spends days marching the village at innocents, and nobody is ever told they were poisoned — including them." },
  'Influencer':     { team: 'evil', kind: 'minion', icon: '🤳', blurb: 'Your image is curated. You register as GOOD to powers. Bluff shamelessly.', how: "Every ability that inspects you reports GOOD. So be the most helpful, most trustworthy voice in the room: claim a strong good role and make the real one argue with you." },
  'WhatsApp Admin': { team: 'evil', kind: 'minion', icon: '📱', blurb: 'Admin of the society group. Each night, the group chat reveals the true role of one good player.', how: "You learn one real good player and their exact role every night. Use it to demolish their claim with total confidence, or hand a teammate a safe role to bluff." },
  'Landlord':       { team: 'evil', kind: 'minion', icon: '🔑', blurb: 'Ten months deposit, no refunds. When you vote to cast someone out, your vote secretly counts twice.', how: "Your vote counts twice and nobody is told. You can shove an execution over the line while looking like one quiet hand. Never be the first to raise it." },
  // demon
  'Rakshasa':       { team: 'evil', kind: 'demon', icon: '👹', blurb: 'The demon of the moonless night. Each night (except the first), choose a resident to devour.', how: "Kill the roles that make information — the Tarot Aunty, the Undertaker — not whoever is shouting. Your minions are your alibi: let them defend you, and never defend them too hard." },

  // ===== MONSOON BLOOD — the rains came and the nights turned deadly =====
  'Ammamma':        { team: 'good', kind: 'villager', icon: '🧕', blurb: 'Grandmother, and far too stubborn to die. The first time you are attacked at night, you survive it.', how: "You survive the first attack on you and you are told it happened. That is proof you were worth killing, which is proof you are good — but only to you, and only if anyone believes you." },
  'Pehelwan':       { team: 'good', kind: 'villager', icon: '🤼', blurb: 'The wrestler. If you are killed at night, you drag one evil player into the light — they are named publicly at dawn.', how: "If you die at night, an evil player is named out loud at dawn. That makes you worth more dead than alive. Bait the demon: act like you know something you do not." },
  'Traffic Cop':    { team: 'good', kind: 'villager', icon: '🚦', blurb: 'Each night, choose a player: learn whether anything attacked them tonight.', how: "You learn whether someone was attacked, even if they lived. A warded target and a dead one both register — so you can confirm the Exorcist is working, or catch a demon that missed." },
  'Sadhu':          { team: 'good', kind: 'villager', icon: '🙏', blurb: 'Each night, ward a player against death. But ward the same person two nights running and your blessing curdles — they die.', how: "You ward like the Exorcist, but warding the same person two nights running kills them. Rotate every night. If you cannot remember who you warded, ward somebody new." },
  'Tantrik':        { team: 'evil', kind: 'minion',   icon: '🕯', blurb: 'Each night, choose a player: every ward and blessing protecting them fails tonight.', how: "You strip wards, turning a wasted demon attack into a real kill. Coordinate: hit whoever the good team is obviously protecting." },
  'Kasai':          { team: 'evil', kind: 'minion',   icon: '🔪', blurb: 'The butcher. If the society casts you out, the demon feeds twice the following night.', how: "If the village casts you out, the demon feeds twice the next night. So play like a minion who wants to get caught — pull suspicion onto yourself once your team is ahead." },
  'Pishach':        { team: 'evil', kind: 'demon',    icon: '🩸', blurb: 'A relentless hunger. Each night (except the first), devour a resident — and if something stops you, you take someone else at random instead.', how: "If your kill is blocked you take somebody else at random instead, so you can never be fully stopped. Attack into protection on purpose when you want the night to get messy." },

  // ===== MAYA — nothing you are told is safe =====
  'Sapnewali':      { team: 'good', kind: 'villager', icon: '💤', blurb: 'The dream-reader. Each night, choose a player: you learn two roles, and one of them is truly theirs.', how: "You learn two roles and one of them is genuinely theirs. That is a soft read, not proof. Cross two dreams about different people and you can narrow both at once." },
  'Guru':           { team: 'good', kind: 'villager', icon: '🧘', blurb: 'Each night, learn whether your two living neighbours are on the same team as each other.', how: "You learn whether your two neighbours match each other, not who they are. \"Same team\" can mean two good or two evil — it only becomes useful next to what they claim." },
  'Kavi':           { team: 'good', kind: 'villager', icon: '📜', blurb: 'The poet writes only of what never was. Each night, learn one role that is NOT in play.', how: "You learn a role that is NOT in this game. That kills a claim outright: if someone claims it, they are lying, and only evil has a reason to invent a role that does not exist." },
  'Pagal':          { team: 'good', kind: 'outsider', icon: '🤪', blurb: 'You are certain you are the demon. You are not. You are good, and you kill nobody.', how: "The app tells you that you are the demon and asks you to kill someone every night. You are good and you kill nobody. If the village executes you they have wasted a day — and if you talk them into believing you, you have wasted the game." },
  'Naqab':          { team: 'evil', kind: 'minion',   icon: '🎭', blurb: 'The mask. Each night, choose a player: to every power in the society, tonight they read as the demon itself.', how: "Each night you paint one good player as the demon to every power that inspects them. Pick someone the village already half-suspects and let their own investigators bury them." },
  'Chhaya':         { team: 'evil', kind: 'demon',    icon: '🌑', blurb: 'The shadow. Each night (except the first), devour a resident. Every power that inspects you says you are GOOD.', how: "Every ability that checks you reports GOOD. You can survive being read out loud in public. Claim an information role, invite the check, and let the village clear you themselves." },

  // ===== SOCIETY AGM — the politics of the vote =====
  'Secretary':      { team: 'good', kind: 'villager', icon: '🗂', blurb: 'You keep the minutes. Each night, learn how many evil players voted to cast someone out today.', how: "You learn how many evil players voted to cast someone out today. Set that against who actually raised a hand — if two evil voted and only five people voted at all, your list is very short." },
  'Auditor':        { team: 'good', kind: 'villager', icon: '🧾', blurb: 'Each night, choose a player: learn how many times they have voted to cast someone out this game.', how: "You learn how often someone has voted to execute across the whole game. Somebody who never votes is hiding. Somebody who votes for everything is steering." },
  'Chamcha':        { team: 'good', kind: 'outsider', icon: '🥄', blurb: 'The yes-man. You are good, but you cannot help yourself — your vote is always counted as YES, whatever you press.', how: "Your vote is counted as YES no matter what you press, and you are never told when it mattered. Warn the village early, or you will help execute your own side." },
  'Broker':         { team: 'evil', kind: 'minion',   icon: '💼', blurb: 'Each night, choose a player: their vote is bought and counts for nothing tomorrow.', how: "You buy one vote a night and that person is never told it was worthless. Spend it on whoever is loudly organising the execution of your teammate." },
  'Netaji':         { team: 'evil', kind: 'demon',    icon: '🎖', blurb: 'The politician. Each night (except the first), devour a resident. The first time the society casts you out, you survive it.', how: "The first time the village casts you out, the paperwork is lost and you stay. So you can afford to look guilty exactly once — bait the execution, survive it, and watch their day evaporate." },
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

