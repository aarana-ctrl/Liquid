// Runs on the Liquid Planner web app. Reads the session token + API base that
// the app saved in localStorage and hands them to the extension, so the
// extension can import on the student's behalf. No copy/paste, no codes.
(function () {
  function sync() {
    try {
      const s = JSON.parse(localStorage.getItem("lp_session") || "null");
      const api = localStorage.getItem("lp_api");
      if (s && s.token && api) chrome.runtime.sendMessage({ type: "lp-auth", token: s.token, api });
    } catch (e) { /* ignore */ }
  }
  sync();
  // re-sync if the user signs in after the page is already open
  window.addEventListener("focus", sync);
  setInterval(sync, 5000);

  // The app asks us to run queued DARS audits in the background (no popup window).
  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "liquid") return;
    if (e.data.type === "lp-run-queue") {
      chrome.runtime.sendMessage({ type: "lp-run-queue-bg" });
    }
    // Course Details request → fetch from DawgPath and post the result back.
    if (e.data.type === "lp-course-req") {
      const reqId = e.data.reqId;
      chrome.runtime.sendMessage({ type: "lp-course-details", courseId: e.data.courseId }, (resp) => {
        window.postMessage({ source: "liquid-ext", type: "lp-course-res", reqId, resp: resp || { ok: false } }, "*");
      });
    }
    // Is the MyPlan session alive? (app asks before offering to rebuild catalog)
    if (e.data.type === "lp-scrape-status-req") {
      chrome.runtime.sendMessage({ type: "lp-scrape-status" }, (resp) => {
        window.postMessage({ source: "liquid-ext", type: "lp-scrape-status-res", resp: resp || { ok: false } }, "*");
      });
    }
    // Full catalog scrape → open a streaming port and relay progress to the page.
    if (e.data.type === "lp-scrape-req") {
      let port;
      try { port = chrome.runtime.connect({ name: "lp-scrape" }); }
      catch (err) { window.postMessage({ source: "liquid-ext", type: "lp-scrape-progress", data: { type: "error", error: "no-extension" } }, "*"); return; }
      port.onMessage.addListener((m) => window.postMessage({ source: "liquid-ext", type: "lp-scrape-progress", data: m }, "*"));
      port.onDisconnect.addListener(() => window.postMessage({ source: "liquid-ext", type: "lp-scrape-progress", data: { type: "closed" } }, "*"));
    }
  });
  // Robustness backstop: independently poll the backend queue every 12s while the
  // app is open, so audits still run even if the page message never fires.
  setInterval(() => { try { chrome.runtime.sendMessage({ type: "lp-check-queue" }); } catch (e) { /* */ } }, 12000);
})();
