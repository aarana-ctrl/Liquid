// Service worker: stores the app session (token + API base) picked up from the
// logged-in web app, performs the authenticated DARS import, and can test the
// connection. A manual `apiOverride` (set in the popup) always wins over the
// API base the web app reported — so the extension works even if the deployed
// site was built pointing at the wrong backend.

function baseUrl(s) { return (s.apiOverride || s.api || "").replace(/\/$/, ""); }

async function readStore() {
  return new Promise((r) => chrome.storage.local.get(["token", "api", "apiOverride"], r));
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "lp-auth") {
    chrome.storage.local.set({ token: msg.token, api: msg.api }, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "lp-set-api") {
    chrome.storage.local.set({ apiOverride: (msg.api || "").trim() }, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "lp-status") {
    readStore().then((s) => sendResponse({ connected: !!(s.token && baseUrl(s)), api: baseUrl(s), override: s.apiOverride || "" }));
    return true;
  }

  // Diagnostic: is the backend reachable, and is our token valid?
  if (msg?.type === "lp-test") {
    (async () => {
      const s = await readStore();
      const api = baseUrl(s);
      if (!api) return sendResponse({ ok: false, stage: "config", detail: "No backend URL. Open Liquid and sign in, or set the backend URL below." });
      try {
        const h = await fetch(api + "/health");
        if (!h.ok) return sendResponse({ ok: false, stage: "health", detail: `Backend returned ${h.status}` });
      } catch (e) {
        return sendResponse({ ok: false, stage: "health", detail: `Can't reach ${api} (${String(e.message || e)})` });
      }
      if (!s.token) return sendResponse({ ok: false, stage: "auth", detail: "Backend is up, but you're not signed in. Open Liquid and sign in." });
      try {
        const me = await fetch(api + "/api/me", { headers: { Authorization: "Bearer " + s.token } });
        if (me.ok) { const j = await me.json().catch(() => ({})); return sendResponse({ ok: true, api, who: j.user?.email || j.email || "signed in" }); }
        return sendResponse({ ok: false, stage: "auth", detail: `Signed-in check failed (${me.status}). Sign in to Liquid again.` });
      } catch (e) {
        return sendResponse({ ok: false, stage: "auth", detail: String(e.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === "lp-import") {
    (async () => {
      const s = await readStore();
      const api = baseUrl(s);
      if (!s.token || !api) { sendResponse({ ok: false, error: "not-connected" }); return; }
      try {
        const r = await fetch(api + "/api/import/dars", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + s.token },
          body: JSON.stringify({ darsText: msg.darsText }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) sendResponse({ ok: true, result: j });
        else sendResponse({ ok: false, status: r.status, detail: j.error || r.statusText, api });
      } catch (e) {
        sendResponse({ ok: false, error: "fetch", detail: String(e.message || e), api });
      }
    })();
    return true; // async
  }
});
