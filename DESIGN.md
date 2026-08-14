# AMAVAS — Design Brief

For generating UI concepts (Stitch, v0, Figma, etc.). This describes the product,
the two art directions under consideration, a color/type system, and every screen
that needs a design.

## What is Amavas

A **mobile-web party game**. 5–20 people sit in one room; each person has the game
open on their own phone. Talking happens face-to-face, out loud — the phone is only
for private information (your secret role), night actions (tap a target while
everyone's eyes are closed), and day voting (accuse/vote on who gets cast out).

Design implications:
- **Portrait phone only.** No desktop layout needed. Target ~375–430px wide.
- **One-handed, thumb-reachable.** Big tap targets. People are also holding a drink,
  sitting cross-legged, not paying full attention to the phone.
- **High tension, low chrome.** This is a horror-tinged social game — the UI should
  feel like part of the game (a spellbook, a case file, a comic panel), not like a
  generic app wrapping the game.
- **Secrecy is a mechanic.** Your role is hidden by default (tap to peek) so people
  glancing at your phone over your shoulder don't spoil it. This UX beat matters —
  don't design it away.
- **Info-dense at times.** By day, a player may be looking at: who's alive, who's
  on the block, an active vote, their own secret notes, and the event log — all at
  once, on a small screen. Prioritize ruthlessly; most of this can collapse/accordion.

## Setting & tone

A Bengaluru apartment society on **Amavas**, the moonless night. A Rakshasa (demon)
has moved in among the residents. It's Indian-cosmopolitan, funny-scary rather than
grim — think "your WhatsApp society group but someone in it is a demon," not gothic
horror. Roles are drawn from a deliberate mashup: Indian mythology (Rakshasa,
Vishkanya, Aghori, tilak, tarot), Bangalore city life (auto-rickshaw, RWA, filter
coffee culture, traffic), and Western pop/party vocabulary (Influencer, Old Monk,
Big Boss). The tone should hold all of that at once without feeling like parody of
any one part of it.

## Two art directions (pick one, or blend)

Both are drawn as reference for the **Rakshasa** character card:
- `public/art/rakshasa.svg` — **Cartoon-spooky.** Moody purple/violet night sky,
  glowing gold eyes, soft gradients, thick dark ink outlines, a dashed "moonless"
  moon, a dim apartment skyline with exactly one lit window. Warmer, more atmospheric,
  closer to a modern indie-horror-game aesthetic.
- `public/art/rakshasa-ack.svg` — **Amar Chitra Katha comic.** Flat saturated
  colors (brick red, marigold yellow, leaf green), bold black ink outlines, no
  gradients, a sunburst behind the head, a classic comic caption box ("THE RAKSHASA
  STRIKES!"), a bold black nameplate banner. Punchier, funnier, more retro-poster.

Recommendation: cartoon-spooky for the app chrome and mood (backgrounds, night
phase, game-over reveal), ACK-style flat illustration for the 15 role cards
themselves — the role reveal is the moment that most wants to feel like a special
collectible card, and flat-color comic art reproduces better at small card sizes
than moody gradients do.

## Color system

Base palette (from the current build, cartoon-spooky leaning):

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#14101f` | app background, near-black violet |
| `--panel` | `#1f1930` | cards, inputs |
| `--panel2` | `#2a2242` | secondary panels, buttons |
| `--ink` | `#e8e2f4` | primary text |
| `--dim` | `#9c92b8` | secondary text, captions |
| `--accent` | `#c9a227` | gold — CTAs, borders, emphasis, "night" glow |
| `--good` | `#4fa3d1` | good team, "spare" actions |
| `--evil` | `#d64550` | evil team, "cast out" actions, danger |

ACK accent palette (available for role cards / comic moments):

| Token | Hex | Use |
|---|---|---|
| brick red | `#7a2e2e` / `#e8432f` | ACK card backgrounds |
| marigold | `#ffd23f` | ACK highlights, sunburst |
| leaf green | `#3fae5c` | ACK secondary |
| ink black | `#1a1a1a` | ACK outlines, nameplates |
| parchment | `#f4e3c1` | ACK card background/paper tone |

Team colors (`--good` blue / `--evil` red) are load-bearing — they appear on vote
buttons, team reveal, and role card borders. Keep that mapping consistent across
any redesign so returning players build instinct for it.

## Type

Currently serif throughout (Georgia) for a storybook/tarot feel — headers use wide
letter-spacing in small caps or all-caps. This is a good direction to keep for
headers/titles/role names even if body text moves to a more legible sans for dense
UI (vote tallies, event log) on small screens.

## Screens to design

1. **Join** — name entry, tagline, single CTA ("Enter the society"). First
   impression of the whole game; sets the tone.
2. **Lobby** — player count vs. min/max (5–20), roster list, host-only "Begin"
   button, WiFi/URL reminder for others to join.
3. **Role reveal** — tap-to-peek card showing role icon/art, name, team (good/evil),
   and power description. Must default to hidden/blurred.
4. **Night — waiting** — most players most nights: "the society sleeps," a count of
   who's still acting. Should feel tense/ambient, not blank.
5. **Night — acting** — a player with a power sees a prompt + a list of targets to
   tap. Needs to be usable in near-dark (people dim their screens).
6. **Day — overview** — the default day screen: living/dead roster, who's on the
   block (if anyone), and entry points to accuse or (if applicable) use a one-shot
   power like the Slayer's strike.
7. **Day — active vote** — someone's been accused; big Cast Out / Spare buttons,
   live vote count, who's still deciding.
8. **Secret inbox** — a player's private log of what their power has told them
   over the game (e.g. "Night 2: the cards say Meera is EVIL"). Needs to feel like
   a private notebook, distinct from the public event log.
9. **Public event log** — the shared town record everyone can see: nominations,
   vote results, deaths, evictions. This is also the primary "what just happened"
   surface after every phase change.
10. **Game over / reveal** — win banner (good vs evil), reason, and the full cast
    reveal (everyone's true role, plus what outsiders like Old Monk *believed*
    they were). This is the payoff screen — worth the most visual weight.
11. **Ghost state** — a dead player's view: greyed/marked in the roster, but they
    can see they still have one ghost vote banked for a future accusation.

## Current implementation (for reference)

Plain HTML/CSS/JS, no framework, no build step — `public/index.html`,
`public/style.css`, `public/client.js`. A redesign can restyle freely; the
underlying state machine (`server.js`) and its WebSocket message shape don't need
to change for a visual pass. Existing CSS custom properties are listed above and
are the fastest lever for a new look before touching markup.
