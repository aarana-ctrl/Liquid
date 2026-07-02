# Firestore setup

The backend stores users, plans, and snapshots. By default it uses a local JSON
file (`server/data/store.json`) so it runs with zero setup. Set `DB=firestore`
to use Google Firestore instead — same code, swappable backend (`server/src/store.firestore.js`).

## Data model

| Collection | Doc id | Fields |
|---|---|---|
| `users` | `provider:sub` (e.g. `uw:<oid>`) | id, email, name, provider, createdAt, lastLogin |
| `plans` | userId | chosen[], schedule{}, completed[], inProgress[], updatedAt |
| `snapshots` | userId | program, catalogYear, gpa, audit{}, earned[], inProgress[], ingestedAt |

One document per user per collection — reads/writes are by user id, so it scales flat and cheap.

## Setup

1. **Create a Firebase project** at console.firebase.google.com (or use an existing GCP project).
2. **Enable Firestore** (Build → Firestore Database → Create, in production mode).
3. **Service account key** — you've already downloaded this JSON. **What to do with it:**
   - **Never commit it.** It's a root credential to your database. Keep it out of git (the server `.gitignore` already excludes `*serviceAccount*.json` and `*-firebase-adminsdk-*.json`).
   - **Local dev:** move the file somewhere outside the repo (e.g. `~/.secrets/liquid-firebase.json`) and point the server at it:
     ```
     DB=firestore
     FIRESTORE_PROJECT_ID=your-project-id
     GOOGLE_APPLICATION_CREDENTIALS=/Users/you/.secrets/liquid-firebase.json
     ```
   - **Hosting (Render/Railway/Fly/etc.):** don't upload the file — open it, copy the entire JSON, and paste it as a single secret env var:
     ```
     DB=firestore
     FIRESTORE_PROJECT_ID=your-project-id
     FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"…", … }
     ```
     `FIREBASE_SERVICE_ACCOUNT` takes priority over the file path, so this is all the host needs.
   - **On Google Cloud (Cloud Run / App Engine / Functions):** you don't need the key at all — Application Default Credentials are automatic. Just set `DB=firestore` and `FIRESTORE_PROJECT_ID`.
4. The server reads these on boot. `GET /health` reports `"store":"firestore"` and the log line shows `store=firestore` when it's active.
5. **Install the driver** (already an optional dependency): `npm install` in `server/` pulls `firebase-admin`.
6. **Run:** `npm start`. Startup logs `store=firestore`; `GET /health` also reports `"store":"firestore"`.

## Security rules

The server talks to Firestore with admin credentials, so all access goes through the API (which enforces the per-user JWT). Lock down direct client access:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /{document=**} { allow read, write: if false; }  // server-only
  }
}
```

## Notes

- The interface in `store.js` is six async functions. To move to Postgres or another DB later, write one more `store.<db>.js` with the same exports and select it in `store.js`.
- The file store remains the default for local dev and CI, so contributors don't need Firebase credentials to run the app.
