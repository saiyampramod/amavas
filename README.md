# 🌑 AMAVAS

A social-deduction party game for **5–20 players in one house** — in the spirit of
Blood on the Clocktower / Werewolf, but an original game set in a **Bengaluru
apartment society**. Everyone sits together in the same room and talks face to face;
phones are only for secret roles, night actions, and voting. No storyteller needed —
the game runs itself.

**Amavas** is the moonless night. On Amavas, a Rakshasa moves into the society.

## How to start a game night

1. On this PC, in the `Jamie games/amavas` folder, run:

```bash
node server.js
```

2. The terminal prints an address like `http://192.168.1.5:3000`.
   Everyone on the **same WiFi** opens that address on their phone and enters their name.
3. The first person to join is the **host** — they press *Begin the first night* once
   everyone (5–20 people) is in.

## How to play

- **Night** — no talking! Players with powers get a secret prompt on their phone.
  When everyone has acted, dawn breaks automatically.
- **Day** — talk it out loud, face to face. Accuse people, defend yourself, lie.
  Accusations and votes happen on phones. Getting at least half the living players'
  votes puts someone ON THE BLOCK; a later accusation needs *more* votes to steal
  the block, and an equal count ties and clears it.
- **Dusk** — the host ends the day; whoever is on the block is evicted.
- **Dead players** may still talk, and keep **one ghost vote** for the rest of the game.
- **Good wins** when the Rakshasa dies. **Evil wins** when it can no longer be stopped.

## The cast

### Good — residents
| Role | Power |
|---|---|
| 🔮 **Tarot Aunty** | Each night, pulls a card on one player: GOOD or EVIL |
| 🕯️ **Exorcist** | Each night, wards one player against the Rakshasa |
| 🛺 **Auto Anna** | Each night, learns how many of their two neighbours are evil |
| 🪦 **Undertaker** | Learns the true role of whoever was cast out that day |
| 🗡️ **Slayer** | Once per game, publicly strikes — if it's the Rakshasa, it dies |
| 😎 **Big Boss** | If 3 remain and nobody is cast out that day, good wins |
| 🦉 **Night Owl** | First night: spots two players, one of whom is evil |
| 🧢 **Aam Aadmi** | No power — appears in big games |

### Good — outsiders (they make life harder)
| Role | Twist |
|---|---|
| 🥃 **Old Monk** | One too many. Convinced they have a power. They don't. All their info is nonsense |
| 🔱 **Aghori** | Good, but may register as EVIL to powers |

### Evil
| Role | Power |
|---|---|
| 🐍 **Vishkanya** | Each night, poisons someone: their power fails or lies |
| 🤳 **Influencer** | Registers as GOOD to powers |
| 📱 **WhatsApp Admin** | Each night, the group chat reveals one good player's true role |
| 🔑 **Landlord** | Their vote to cast out secretly counts twice. Ten months deposit, no refunds |
| 👹 **Rakshasa** | The demon. Each night (except the first), devours a resident |

Evil players know each other from night one. Good players know nothing — trust no one.

## Tips for the host

- Phones face down during the day except when voting.
- Absolute silence at night — the fun dies if people peek or whisper.
- If someone disconnects, they can rejoin from the same phone browser and
  their seat is restored automatically.
- After a game ends, press *Play again* — new people can also join between games,
  and anyone who left is dropped automatically.

## Two ways to run it

The host picks one in the lobby.

### Host mode (default) — everyone plays

Nobody sits out, and **nobody sees anyone's secrets, including the host.** The host only
gets the pacing controls: begin the night, end the day when the room feels done.

The balancing is done by the **unseen storyteller** built into the app. It watches the
game and stays completely out of the way until it looks like things are about to end too
early — one more death and evil takes it, or good has already gutted evil by day two.
Only then does it lean on calls it was making anyway:

- the lie a poisoned player is told becomes helpful or harmful, depending who needs it
- the Aghori reads evil when good needs a red herring
- a blocked Pishach takes the least costly target instead of the worst one
- at most twice a game, a kill that would end it right there simply doesn't land
- once a game, if it's badly lopsided, it privately offers one player the chance to
  **switch sides** — a secret they answer alone on their own phone

None of it is announced. When the game ends, everyone sees exactly what it did under
**"What the night decided."** Toggle it off in the lobby for a purely vanilla game.

### Storyteller mode — one person runs it

One person sits out and gets three powers:

- **Judgement calls.** Whenever the rules are ambiguous the night *pauses* and asks them:
  what lie does a poisoned player get told, does the Aghori read evil tonight, which two
  players does the Night Owl see, who does a blocked Pishach take instead. Every prompt has
  a *Let the app choose* button so you can keep the pace up.
- **The Grimoire.** Every true role, who is poisoned, who is warded, who still has to act,
  who has voted to cast out how many times — live.
- **Whispers, twists and heavier hands.** Send any player private text at any time (it lands
  in their secret intel and reads like their own role told them). Hand someone a brand new
  role mid-game, or offer them the chance to switch sides. And when one side is running away
  with it: poison, kill, revive, or restore a ghost vote.

Pacing is yours in both modes — the day only ends when you tap it, so read the room.

If the Storyteller closes their phone the game does not stall: any open judgement call falls
back to the engine and the host controls pass to someone still connected.

## Look & feel

The UI is a cyber-noir "dossier" design (Stitch-generated direction): near-black slate,
electric-blue primary `#98cbff`, coral `#ff6f5f` for danger, Epilogue / Inter / JetBrains Mono,
film grain, glass panels and shimmer. Your role is hidden behind a **press-and-hold seal**
so a shoulder-glance can't spoil it.

Every role has a hand-drawn **cartoon-spooky portrait** (`public/art/portraits.js`) — one shared
template with per-role hair, eyes, facial hair and props, tinted blue for good and coral for evil.
Other players always show a neutral initials avatar: roles are secret, so portraits only ever
appear on your own role card and the final reveal.

- `public/art/` — open in a browser for the live cast sheet
- `node make-cast-sheet.js` — regenerates `public/art/cast-sheet.svg` for review

### Works with no internet

Game night WiFi often has no uplink, so Tailwind and all fonts are **vendored into
`public/vendor/`** (~1.9 MB) and the page makes zero external requests. If you ever need to
refresh them, run `node vendor-assets.js` while online.

## Hosting online (beyond house WiFi)

The game is a single always-on Node server, so it needs a host that supports
long-running processes and WebSockets — **Render.com or Railway.app free tiers work
as-is** (`npm start`). Vercel does not support this kind of server. One warning:
the free tiers sleep when idle, so open the page a minute before game night starts.

## Testing

Run a server on port 3100 first (`$env:PORT='3100'; node server.js`), one per game —
a finished game stays in its "over" state until the host starts a new one.

- `node smoke.js 8 monsoon` — full automated 8-bot game on a given story mode.
- `node smoke-st.js 9 maya` — same, but one bot storytells and answers every judgement call.
- `node smoke-st-drop.js` — the Storyteller quits mid-judgement; the game must still finish.
- `node demo-bots.js 4` — 4 bots join the live game on port 3000 and play along.
