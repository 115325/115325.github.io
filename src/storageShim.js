// Emulates the `window.storage` API that Claude-artifact apps get for free
// (get/set/delete/list), using the browser's localStorage instead — so this
// app can run standalone on GitHub Pages, with no Anthropic platform behind it.
//
// IMPORTANT LIMITATION: localStorage is per-browser, per-device. In the
// original Claude artifact, "shared" storage was visible to everyone who
// opened the app — that's how accounts could see each other's map, notes,
// and leaderboard. Here, "shared" data only lives in *your own* browser, so
// each visitor effectively gets their own private copy of the whole app:
// no cross-device sync, and no real collaboration between different people.
// The app will run and feel complete for one person on one device/browser,
// but the multi-user features (accounts other than your own, a real shared
// leaderboard, collaborative notes with someone else, etc.) won't do
// anything useful until this is swapped for a real backend — see the
// "Going further" section in DEPLOY.md for how to do that with Firebase or
// Supabase without changing anything else in App.jsx.

const NS = "studymap_v1";

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(NS) || "{}");
  } catch (e) {
    return {};
  }
}
function writeStore(store) {
  localStorage.setItem(NS, JSON.stringify(store));
}
function scopedKey(key, shared) {
  return `${shared ? "shared" : "personal"}::${key}`;
}

function install() {
  window.storage = {
    async get(key, shared = false) {
      const store = readStore();
      const k = scopedKey(key, shared);
      if (!(k in store)) {
        throw new Error(`Key not found: ${key}`);
      }
      return { key, value: store[k], shared };
    },

    async set(key, value, shared = false) {
      const store = readStore();
      store[scopedKey(key, shared)] = value;
      writeStore(store);
      return { key, value, shared };
    },

    async delete(key, shared = false) {
      const store = readStore();
      const k = scopedKey(key, shared);
      const existed = k in store;
      delete store[k];
      writeStore(store);
      return existed ? { key, deleted: true, shared } : null;
    },

    async list(prefix = "", shared = false) {
      const store = readStore();
      const scopePrefix = `${shared ? "shared" : "personal"}::${prefix}`;
      const keys = Object.keys(store)
        .filter((k) => k.startsWith(scopePrefix))
        .map((k) => k.slice(scopePrefix.length - prefix.length));
      return { keys, prefix, shared };
    },
  };
}

install();
