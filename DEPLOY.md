# Deploying Study Map to GitHub Pages

## Before you start: the one real limitation

The original app saved everything through `window.storage`, an API that only
exists inside Claude. GitHub Pages just serves static files — there's no
server behind it — so `src/storageShim.js` replaces `window.storage` with a
version backed by your browser's `localStorage`.

That makes the app fully functional again, but **storage becomes local to
your own browser on your own device**. Concretely:

- Your account, progress, pinned subjects, schedule, and notes will all work
  and persist for you, in that browser.
- Nobody else who visits the site will see your data, or you theirs — each
  visitor gets their own separate local copy of everything, including the
  subject/topic map itself. There's no real shared leaderboard or
  collaborative notes between different people until this is swapped for an
  actual backend (see "Going further" at the bottom).
- Clearing your browser data / using a different browser or device = a fresh,
  empty app.

If you only need this for yourself, on one browser, you're done — skip to
Steps.

## Steps

**1. Copy this project into your repo**

Copy every file here (including the hidden `.github` folder) into your
existing repo's folder, then:

```bash
cd your-repo
git add .
git commit -m "Add Study Map app"
git push
```

**2. Turn on GitHub Pages, pointed at GitHub Actions**

On GitHub: your repo → **Settings** → **Pages** → under "Build and
deployment", set **Source** to **GitHub Actions**. (Not "Deploy from a
branch" — the workflow here handles the build itself.)

**3. Let the workflow run**

Pushing to `main` triggers `.github/workflows/deploy.yml` automatically: it
installs dependencies, runs `npm run build`, and publishes the result. Watch
it under the **Actions** tab. When it finishes, your repo's **Settings → Pages**
will show the live URL — something like:

```
https://<your-username>.github.io/<your-repo-name>/
```

That's it — no repo name to hardcode anywhere; the build uses relative paths
so it works at whatever subpath GitHub Pages serves it from.

## Developing locally first (optional but recommended)

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Try creating an account, adding a subject,
pinning it, writing a note — confirm it all persists across a page refresh
before you push.

## Going further: real multi-user storage

To get genuine shared data back (so a shared leaderboard, collaborative
notes, and a common subject map actually work between different people),
swap `storageShim.js` for `storageFirebase.js` — **see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**
for the full walkthrough (free, ~5 minutes, no credit card). The rest of the
app (`App.jsx`) doesn't need to change either way, since it only ever calls
`window.storage.get/set/delete/list` — `main.jsx` just picks which
implementation of that interface backs it.
