# Setting up Firebase (free) for real shared data

This gets you genuine shared data between different visitors — a real
leaderboard, collaborative notes, one shared subject map — instead of the
localStorage version where every visitor only sees their own copy.

It's free (Firebase's "Spark" plan, no credit card required) and takes about
5 minutes.

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com/> and sign in with any Google
   account.
2. Click **Add project**. Name it anything (e.g. "study-map").
3. You can disable Google Analytics for this project — not needed. Click
   **Create project**.

## 2. Turn on Firestore

1. In the left sidebar: **Build → Firestore Database**.
2. Click **Create database**.
3. Choose any location close to you (can't be changed later, but it doesn't
   meaningfully matter for a small app like this).
4. Start in **test mode** for now — this opens read/write to anyone for 30
   days by default. We'll replace that with permanent (but still simple)
   rules in step 4 below, so the 30-day expiry doesn't matter.

## 3. Register a web app and get your config

1. Click the gear icon next to **Project Overview** → **Project settings**.
2. Scroll to **Your apps**, click the **</>** (web) icon.
3. Give it any nickname, click **Register app**. You do *not* need Firebase
   Hosting — skip that step.
4. You'll see a `firebaseConfig` object like this:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "study-map-xxxxx.firebaseapp.com",
     projectId: "study-map-xxxxx",
     storageBucket: "study-map-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123",
   };
   ```
   Copy these six values into `src/storageFirebase.js` in this project,
   replacing the `YOUR_...` placeholders.

## 4. Set permanent security rules

In Firestore → **Rules** tab, replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /studymap_shared/{key} {
      allow read, write: if true;
    }
  }
}
```

Click **Publish**.

**What this means, honestly:** anyone who has your app's URL can read and
write everything in this collection — there's no per-user access control at
the database level (the app's own login is just a username/password check
inside the app, unrelated to who can talk to Firestore directly). That's a
reasonable tradeoff for a small trusted study group, the same way the
original Claude-hosted version worked. It is **not** appropriate for
anything sensitive. If you want real per-user access control later, that
means wiring up Firebase Authentication and rules that check `request.auth`,
which is a bigger change — ask if you want help with that route.

## 5. Switch the app to use it

In `src/main.jsx`, swap which storage import is active:

```js
// import './storageShim.js'
import './storageFirebase.js'
```

Then:

```bash
npm install
npm run dev
```

Try it locally first — sign up, add a subject, pin it — then open the
Firestore console (**Build → Firestore Database → Data**) and confirm you
see a `studymap_shared` collection filling up with documents as you use the
app. Once you're happy, commit and push as normal; the GitHub Actions
workflow builds and deploys it exactly the same either way.
