# Putting AMAVAS online

AMAVAS is one long-running Node process that holds every room in memory and talks to
phones over WebSockets. That rules out serverless hosts. **Render** and **Railway** both
run it as-is from this repo, free.

You need to do the account steps yourself — I can't and shouldn't handle your logins.
Everything else is already committed and ready.

## Option A — Render (recommended)

1. Create a **public** repo on github.com called `amavas` (no README, no .gitignore).
2. From this folder:

```bash
git remote add origin https://github.com/YOUR-USERNAME/amavas.git
```

```bash
git push -u origin main
```

3. Go to <https://dashboard.render.com> → **New → Web Service** → connect that repo.
   Render reads `render.yaml` and fills everything in: Node, `npm install`, `node server.js`,
   free plan, health check on `/healthz`. Click **Create**.
4. Two minutes later you get a URL like `https://amavas.onrender.com`. That's the game.

## Option B — Railway

<https://railway.app> → **New Project → Deploy from GitHub repo** → pick `amavas`.
Nixpacks detects Node and runs `npm start`. No config needed.

## After it's live

Send anyone the URL. They enter a name and either **start a new game** (which mints a
4-letter room code) or **type a code** to join a friend's. Many groups can play at once —
each room is completely separate.

The lobby also has a **Copy invite link** button, which produces
`https://your-app.onrender.com/?room=WYL3` and prefills the code for whoever opens it.

## Things worth knowing

- **Free tiers sleep.** After ~15 minutes idle the service spins down; the next visitor
  waits ~30 seconds for it to wake. Open the page a minute before people arrive.
- **A restart wipes rooms in progress.** Game state lives in memory, deliberately — it
  keeps the whole thing dependency-free. Sessions are short, so this only matters if the
  host redeploys mid-game.
- **Empty rooms are swept** 30 minutes after the last person disconnects.
- **It still works with no internet.** Tailwind and all fonts are vendored, so `node server.js`
  on a laptop over house WiFi remains the zero-dependency fallback if the WiFi is offline.

## Updating it later

```bash
git commit -am "whatever changed" && git push
```

Render and Railway both redeploy on push automatically.
