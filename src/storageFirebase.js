// Firebase-backed replacement for window.storage — this is what actually
// gives you real shared/collaborative data between different visitors,
// unlike storageShim.js (localStorage), which only works for one person on
// one browser.
//
// Setup required before this works — see FIREBASE_SETUP.md.

import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, collection,
  query, orderBy, startAt, endAt, getDocs, documentId,
} from "firebase/firestore";

// Fill these in from your Firebase project settings — see FIREBASE_SETUP.md
// for exactly where to find them. It's normal and safe for these to be
// visible in client-side code: they identify your project, they are not
// secret credentials. Who can actually read/write your data is controlled
// by your Firestore security rules instead (also covered in that file).
const firebaseConfig = {
  apiKey: "AIzaSyBHsxacNiN5P79D25HX4YmuVEbrPCz51Ow",
  authDomain: "ibstudymap.firebaseapp.com",
  projectId: "ibstudymap",
  storageBucket: "ibstudymap.firebasestorage.app",
  messagingSenderId: "104728955853",
  appId: "1:104728955853:web:cc27cd01002d17effa5284",
  measurementId: "G-7MFNDW5DGY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const COLLECTION = "studymap_shared";

// The app only ever uses shared:false for one thing — a "stay signed in on
// this device" pointer — which genuinely makes more sense kept local per
// browser than synced, so that part still just uses localStorage.
const LOCAL_NS = "studymap_local";
function localRead() {
  try { return JSON.parse(localStorage.getItem(LOCAL_NS) || "{}"); }
  catch (e) { return {}; }
}
function localWrite(store) {
  localStorage.setItem(LOCAL_NS, JSON.stringify(store));
}

function install() {
  window.storage = {
    async get(key, shared = false) {
      if (!shared) {
        const store = localRead();
        if (!(key in store)) throw new Error(`Key not found: ${key}`);
        return { key, value: store[key], shared };
      }
      const snap = await getDoc(doc(db, COLLECTION, key));
      if (!snap.exists()) throw new Error(`Key not found: ${key}`);
      return { key, value: snap.data().value, shared };
    },

    async set(key, value, shared = false) {
      if (!shared) {
        const store = localRead();
        store[key] = value;
        localWrite(store);
        return { key, value, shared };
      }
      await setDoc(doc(db, COLLECTION, key), { value, updatedAt: Date.now() });
      return { key, value, shared };
    },

    async delete(key, shared = false) {
      if (!shared) {
        const store = localRead();
        const existed = key in store;
        delete store[key];
        localWrite(store);
        return existed ? { key, deleted: true, shared } : null;
      }
      const ref = doc(db, COLLECTION, key);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      await deleteDoc(ref);
      return { key, deleted: true, shared };
    },

    async list(prefix = "", shared = false) {
      if (!shared) {
        const store = localRead();
        return { keys: Object.keys(store).filter((k) => k.startsWith(prefix)), prefix, shared };
      }
      // The standard Firestore "starts with" trick: a range query on document
      // ID from the prefix up to the prefix plus the highest possible
      // Unicode character, which catches everything starting with it.
      const q = query(
        collection(db, COLLECTION),
        orderBy(documentId()),
        startAt(prefix),
        endAt(prefix + "\uf8ff"),
      );
      const snaps = await getDocs(q);
      return { keys: snaps.docs.map((d) => d.id), prefix, shared };
    },
  };
}

install();
