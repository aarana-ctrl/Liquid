// Service worker: stores the app session (token + API base) picked up from the
// logged-in web app, and performs the authenticated DARS import.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "lp-auth") {
    chrome.storage.local.set({ token: msg.token, api: msg.api }, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "lp-status") {
    chrome.storage.local.get(["token", "api"], (s) => sendResponse({ connected: !!(s.token && s.api), api: s.api || "" }));
    return true;
  }
  if (msg?.type === "lp-import") {
    chrome.storage.local.get(["token", "api"], async ({ token, api }) => {
      if (!token || !api) { sendResponse({ ok: false, error: "not-connected" }); return; }
      try {
        const r = await fetch(api.replace(/\/$/, "") + "/api/import/dars", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ darsText: msg.darsText }),
        });
        const j = await r.json().catch(() => ({}));
        sendResponse({ ok: r.ok, result: j });
      } catch (e) { sendResponse({ ok: false, error: String(e) }); }
    });
    return true; // async
  }
});
