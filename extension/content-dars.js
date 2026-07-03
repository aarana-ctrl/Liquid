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
  chrome.runtime.onMessage.addListener((m) => {
    if (m && m.type === "lp-do-import") doImport(true);
    if (m && m.type === "lp-run-queue") processQueue(true);
  });

  // --- Auto-audit queue: run DARS for programs the app asked for --------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s || "").toLowerCase().replace(/\s*\([^)]*\)\s*/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

  // Find the "Audit a different program / Run a new audit" entry control.
  function findNewAuditControl() {
    const els = [...document.querySelectorAll('button, a, [role="button"]')];
    return els.find((e) => /audit a different program|run a new audit|different program|new audit|change program/i.test(e.textContent || "")) || null;
  }
  // Find a control (option / list item / input) matching the program name.
  function findProgramOption(name) {
    const n = norm(name);
    // a <select> with matching option
    for (const sel of document.querySelectorAll("select")) {
      const opt = [...sel.options].find((o) => { const t = norm(o.textContent); return t.includes(n) || n.includes(t); });
      if (opt) return { type: "select", sel, value: opt.value };
    }
    // a clickable option / menu item
    const clickable = [...document.querySelectorAll('li, [role="option"], .option, button, a')]
      .find((e) => { const t = norm(e.textContent); return t && (t === n || t.includes(n) || n.includes(t)); });
    if (clickable) return { type: "click", el: clickable };
    return null;
  }

  async function driveNewAudit(name) {
    // Open the program picker if there is one.
    const entry = findNewAuditControl();
    if (entry) { entry.click(); await sleep(1200); }
    // Type into a search box if present (helps long option lists render).
    const search = document.querySelector('input[type="search"], input[placeholder*="program" i], input[placeholder*="search" i]');
    if (search) {
      search.focus();
      search.value = name.replace(/\s*\(.*/, "");
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(1000);
    }
    const opt = findProgramOption(name);
    if (!opt) return false; // fail safe — don't click blindly
    if (opt.type === "select") {
      opt.sel.value = opt.value;
      opt.sel.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      opt.el.click();
    }
    await sleep(1200);
    // Submit / run the audit if there's an explicit button.
    const run = [...document.querySelectorAll('button, a, [role="button"]')]
      .find((e) => /^(run audit|run|submit|audit)$/i.test((e.textContent || "").trim()));
    if (run) run.click();
    // Wait for the audit to (re)render, then let the observer auto-import it.
    for (let i = 0; i < 20; i++) { await sleep(1500); if (norm(document.body.innerText).includes(norm(name).split(" ")[0])) break; }
    await sleep(2500);
    doImport(false);
    return true;
  }

  let queueRunning = false;
  async function processQueue(manual) {
    if (queueRunning) return;
    chrome.runtime.sendMessage({ type: "lp-queue" }, async (resp) => {
      if (!resp || !resp.ok || !resp.queue || !resp.queue.length) { if (manual) toast("No programs queued for auto-audit.", true); return; }
      queueRunning = true;
      toast("Auto-running DARS for " + resp.queue.length + " program" + (resp.queue.length > 1 ? "s" : "") + "…", true);
      for (const item of resp.queue) {
        try {
          const ok = await driveNewAudit(item.name);
          if (ok) { chrome.runtime.sendMessage({ type: "lp-queue-done", name: item.name }); toast("✓ " + item.name + " audited.", true); }
          else { toast("Couldn't auto-select “" + item.name + "”. Run it once manually and I'll capture it.", false); }
          await sleep(2500);
        } catch (e) { /* keep going */ }
      }
      queueRunning = false;
    });
  }

  // Initial import once the SPA renders, then watch for program changes.
  setTimeout(() => doImport(false), 2500);
  // Once the current audit is captured, process any programs the app queued.
  setTimeout(() => processQueue(false), 7000);

  // Re-check when the page content mutates (running a different program's audit
  // rewrites the same page), debounced. This is what captures each program.
  let t;
  const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => doImport(false), 1500); });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  // Safety net: also poll every 6s in case mutations are missed.
  setInterval(() => doImport(false), 6000);
})();
