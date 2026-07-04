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
    if (e.source === window && e.data && e.data.source === "liquid" && e.data.type === "lp-run-queue") {
      chrome.runtime.sendMessage({ type: "lp-run-queue-bg" });
    }
  });
})();
