// Runs on the UW MyPlan DARS audit page. Reads the rendered audit text and
// sends it to the extension to import — automatically on load, and on demand
// from the popup.
(function () {
  function looksLikeDars(t) { return /Audit a UW Degree Program|Earned:\s*\d+\s*credits|DEGREE REQUIREMENTS/i.test(t); }

  function toast(text, ok) {
    const d = document.createElement("div");
    d.textContent = text;
    Object.assign(d.style, {
      position: "fixed", right: "18px", bottom: "18px", zIndex: 999999,
      background: ok ? "#18b083" : "#3a2f80", color: "#fff", padding: "12px 16px",
      borderRadius: "12px", font: "600 13px -apple-system,system-ui,sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,.3)", maxWidth: "320px",
    });
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 5000);
  }

  function doImport(manual) {
    const text = document.body.innerText || "";
    if (!looksLikeDars(text)) { if (manual) toast("Open your DARS audit page first.", false); return; }
    chrome.runtime.sendMessage({ type: "lp-import", darsText: text }, (resp) => {
      if (resp && resp.ok) {
        const cr = (resp.result && resp.result.audit && resp.result.audit.earned) || 0;
        toast("✓ Synced to Liquid Planner — " + cr + " credits imported.", true);
      } else if (resp && resp.error === "not-connected") {
        toast("Open Liquid Planner and sign in once, then revisit this page.", false);
      } else {
        toast("Liquid Planner sync failed. Try the popup → Sync now.", false);
      }
    });
  }

  // allow the popup to trigger a sync
  chrome.runtime.onMessage.addListener((m) => { if (m && m.type === "lp-do-import") doImport(true); });

  // auto-import shortly after the SPA renders
  setTimeout(() => doImport(false), 2500);
})();
