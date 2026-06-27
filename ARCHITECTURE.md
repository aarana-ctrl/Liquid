# Liquid Planner — Architecture

One backend, many clients. A student signs in with Google or Apple on any device; their degree audit, course plan, and quarter calendar live on the server, so the web app and the SwiftUI iOS app always show the same thing.

```
                       ┌──────────────────────────────┐
                       │     Liquid Planner API        │
   Google / Apple ID   │  (server/ — Node + Express)   │
   token ───────────►  │  auth · plan · snapshot       │
                       │  store: users / plans / snaps │
                       └───────▲───────────▲──────────┘
                               │ Bearer JWT │
              ┌────────────────┘            └───────────────┐
              │                                              │
     ┌────────┴────────┐                          ┌──────────┴─────────┐
     │   Web app        │                          │   SwiftUI iOS app   │
     │  (web-app/)      │                          │   (future)          │
     │  React + Vite    │                          │  URLSession + JWT   │
     └────────▲─────────┘                          └────────────────────┘
              │ POST /api/snapshot (once)
     ┌────────┴───────────────────────┐
     │  Connect-and-read agent         │
     │  (Claude in Chrome on MyPlan)   │  reads DARS audit + course search
     └─────────────────────────────────┘
```

## Why a backend (not just the browser extension)

The extension can read MyPlan because the student is logged in *in that browser*. A phone, or a friend's laptop, has no such session. So the scrape happens **once** through the browser agent, which `POST`s the parsed audit to the backend. From then on every device just calls `GET /api/snapshot`. The extension is an *importer*, not a runtime dependency.

## Identity → data

1. Sign in with Google/Apple → provider returns an **ID token**.
2. Client sends it to `POST /api/auth/{google|apple}`; the server verifies it against the provider's JWKS and issues a **30-day app JWT**.
3. The user id is `provider:sub`, stable across devices — log in anywhere, get the same account.
4. All reads/writes use the JWT. Plan edits (`PUT /api/plan`) and snapshot (`GET /api/snapshot`) are per-user, so the calendar syncs automatically.

## What's saved server-side

- **Plan** — chosen electives/gen-eds, the quarter schedule (`{courseId: quarterIndex}`), and the completed/in-progress course lists.
- **Snapshot** — the latest MyPlan/DARS audit (program, GPA, earned/in-progress/needed credits, per-category progress).

## SwiftUI client contract

The iOS app uses the *same* API. Sketch:

```swift
// 1) Native Sign in with Apple → identityToken
let cred = ASAuthorizationAppleIDCredential // from ASAuthorizationController
let idToken = String(data: cred.identityToken!, encoding: .utf8)!

// 2) Exchange for an app session token
struct Session: Decodable { let token: String; let user: User }
var req = URLRequest(url: base.appendingPathComponent("/api/auth/apple"))
req.httpMethod = "POST"
req.setValue("application/json", forHTTPHeaderField: "Content-Type")
req.httpBody = try JSONEncoder().encode(["idToken": idToken])
let (data, _) = try await URLSession.shared.data(for: req)
let session = try JSONDecoder().decode(Session.self, from: data)
// store session.token in the Keychain

// 3) Authenticated calls reuse the token
func authed(_ path: String) -> URLRequest {
    var r = URLRequest(url: base.appendingPathComponent(path))
    r.setValue("Bearer \(session.token)", forHTTPHeaderField: "Authorization")
    return r
}
let plan = try await URLSession.shared.data(for: authed("/api/plan"))      // GET saved plan
let audit = try await URLSession.shared.data(for: authed("/api/snapshot")) // GET DARS snapshot
```

Sign in with Apple is native on iOS (no web view). Google sign-in on iOS uses the GoogleSignIn SDK, which yields an ID token you send to `POST /api/auth/google`. Both hit the same backend the web app uses, so a plan edited on the phone shows up on the web and vice-versa.

## Repository layout

```
Course/
├── web-app/      React + Vite web client (auth, requirements, quarter planner, pathway graph)
│   ├── src/api.js     backend client (falls back to local mode if offline)
│   ├── src/auth.js    provider sign-in (demo + real OAuth hooks)
│   └── public/student-snapshot.json   live MyPlan snapshot the app fetches
├── server/       Node + Express API (auth · plan · snapshot · storage)
└── ARCHITECTURE.md / INTEGRATION.md / AUTH.md / web-app/HOSTING.md
```

## Honest status

- Backend is real and verified locally (login → JWT → save/load plan → ingest/read snapshot → second device reads the same data).
- Sign-in is still a **demo** flow end-to-end; flipping to real OAuth needs Google/Apple client IDs + the server's `*_CLIENT_ID` env vars (code paths already there).
- Nothing is deployed to a public URL yet — that needs your hosting account. `server/README.md` lists the options.
- The MyPlan scrape is still run on demand through the browser agent; automating it per-user on a schedule is a later step.
