// Runs on the UW MyPlan DARS audit page. Reads the rendered audit text and
// sends it to Liquid to import — automatically on load, on demand from the
// popup, AND every time you run a *different* program's audit ("Audit a
// different program"). Each program you open is captured, so Compare mode has
// the exact, per-category numbers for every major/minor you audit.
(function () {
  function looksLikeDars(t) { return /Audit a UW Degree Program|Earned:\s*\d+\s*credits|DEGREE REQUIREMENTS/i.test(t); }

  // A fingerprint of the audit currently on screen, so we only re-import when it
  // actually changes (different program, or refreshed numbers).
  function signature(t) {
    const prog = (t.match(/BACHELOR OF (?:SCIENCE|ARTS) \(([^)]+)\)/i) || [])[1] || "";
    const cr = (t.match(/Earned:\s*(\d+)\s*credits\s*In-progress:\s*(\d+)\s*credits\s*Needs:\s*(\d+)\s*credits/i) || []).slice(1).join("-");
    return (prog + "|" + cr).trim();
  }
  function programName(t) {
    const p = (t.match(/BACHELOR OF (?:SCIENCE|ARTS) \(([^)]+)\)/i) || [])[1];
    return p ? p.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "your degree";
  }

  function toast(text, ok) {
    const d = document.createElement("div");
    d.textContent = text;
    Object.assign(d.style, {
      position: "fixed", right: "18px", bottom: "18px", zIndex: 999999,
      background: ok ? "#18b083" : "#3a2f80", color: "#fff", padding: "12px 16px",
      borderRadius: "12px", font: "600 13px -apple-system,system-ui,sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,.3)", maxWidth: "340px",
    });
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 5000);
  }

  let lastSig = "";
  let busy = false;

  function doImport(manual) {
    const text = document.body.innerText || "";
    if (!looksLikeDars(text)) { if (manual) toast("Open your DARS audit page first.", false); return; }
    const sig = signature(text);
    if (!manual && (busy || sig === lastSig || !sig.replace(/\|.*/, ""))) return; // nothing new
    busy = true;
    chrome.runtime.sendMessage({ type: "lp-import", darsText: text }, (resp) => {
      busy = false;
      if (resp && resp.ok) {
        lastSig = sig;
        const n = resp.result && resp.result.programsKnown;
        toast("✓ " + programName(text) + " synced to Liquid" + (n ? ` — ${n} program${n > 1 ? "s" : ""} captured for Compare.` : "."), true);
      } else if (resp && resp.error === "not-connected") {
        toast("Open Liquid and sign in once, then revisit this page.", false);
      } else if (resp && resp.status === 401) {
        toast("Liquid: your session expired. Sign in to Liquid again, then retry.", false);
      } else if (resp && (resp.error === "fetch" || resp.detail)) {
        toast("Liquid sync failed — " + (resp.detail || "backend unreachable") + (resp.api ? " (" + resp.api + ")" : "") + ". Open the popup → Test connection.", false);
      } else {
        toast("Liquid sync failed. Open the popup → Test connection.", false);
      }
    });
  }

  // allow the popup to trigger a sync
  chrome.runtime.onMessage.addListener((m) => { if (m && m.type === "lp-do-import") doImport(true); });

  // Initial import once the SPA renders, then watch for program changes.
  setTimeout(() => doImport(false), 2500);

  // Re-check when the page content mutates (running a different program's audit
  // rewrites the same page), debounced. This is what captures each program.
  let t;
  const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => doImport(false), 1500); });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  // Safety net: also poll every 6s in case mutations are missed.
  setInterval(() => doImport(false), 6000);
})();
