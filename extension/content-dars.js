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
  // Selectors calibrated against the live MyPlan DARS "Choose Different Program"
  // UI: a #degreeTypeSelector (Major/Minor) and a #programSelector (native
  // <select>s, React-controlled), plus an "Audit Your Degree" primary button.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Normalize a program name for matching: drop parentheticals (B.A./B.S. etc.)
  // and the words "major"/"minor", keep the distinguishing words.
  const norm = (s) => String(s || "").toLowerCase()
    .replace(/\([^)]*\)/g, " ").replace(/\b(minor|major)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim();

  // Set a React-controlled <select> value: use the native setter so React's
  // value tracker sees the change, then dispatch the change event it listens to.
  function setNativeSelect(el, value) {
    const d = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
    d.set.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function openPicker() {
    if (document.querySelector("#programSelector")) return true;
    const btn = [...document.querySelectorAll("button, a")]
      .find((e) => /choose different program|different program|change program/i.test(e.textContent || ""));
    if (!btn) return false;
    btn.click();
    for (let i = 0; i < 12; i++) { await sleep(400); if (document.querySelector("#programSelector")) return true; }
    return !!document.querySelector("#programSelector");
  }

  function matchOption(select, name) {
    const target = norm(name);
    const opts = [...select.options].filter((o) => o.value && !/select a program/i.test(o.textContent));
    return opts.find((o) => norm(o.textContent) === target)
      || opts.find((o) => { const t = norm(o.textContent); return t && (t.includes(target) || target.includes(t)); })
      || null;
  }

  async function driveNewAudit(name, level) {
    if (!(await openPicker())) return false;
    const type = document.querySelector("#degreeTypeSelector");
    if (!type) return false;
    // Major vs minor determines which programs #programSelector lists.
    const wantMinor = level === "minor";
    const typeOpt = [...type.options].find((o) => wantMinor ? /minor/i.test(o.textContent) : /major/i.test(o.textContent));
    if (typeOpt && type.value !== typeOpt.value) { setNativeSelect(type, typeOpt.value); await sleep(1200); }
    // Program list re-renders after the type change — re-query it.
    const prog = document.querySelector("#programSelector");
    if (!prog) return false;
    const opt = matchOption(prog, name);
    if (!opt) return false; // fail safe — never guess-click
    setNativeSelect(prog, opt.value);
    await sleep(700);
    const run = [...document.querySelectorAll("button, a, input[type=submit]")]
      .find((b) => /audit your degree/i.test(b.textContent || b.value || ""));
    if (!run) return false;
    run.click();
    // Wait for the audit for this program to render; the observer then imports it.
    const key = norm(name).split(" ")[0];
    for (let i = 0; i < 24; i++) { await sleep(1200); if (norm(document.body.innerText).includes(key)) break; }
    await sleep(2500);
    doImport(false);
    return true;
  }

  // Scrape the FULL major + minor program lists from the picker (non-destructive
  // — never clicks "Audit Your Degree") and push them to the backend so the app's
  // Majors & Minors list is comprehensive and matches DARS exactly.
  let catalogDone = false;
  async function syncCatalog() {
    if (catalogDone) return;
    try {
      if (!(await openPicker())) return;
      const type = document.querySelector("#degreeTypeSelector");
      if (!type) return;
      const majorVal = [...type.options].find((o) => /major/i.test(o.textContent))?.value;
      const minorVal = [...type.options].find((o) => /minor/i.test(o.textContent))?.value;
      const readOptions = () => [...(document.querySelector("#programSelector")?.options || [])]
        .map((o) => o.textContent.trim()).filter((t) => t && !/select a program/i.test(t));
      const original = type.value;
      setNativeSelect(type, majorVal); await sleep(1200);
      const majors = readOptions();
      setNativeSelect(type, minorVal); await sleep(1200);
      const minors = readOptions();
      setNativeSelect(type, original); // restore
      if (majors.length && minors.length) {
        chrome.runtime.sendMessage({ type: "lp-catalog", majors, minors }, (r) => {
          if (r && r.ok) { catalogDone = true; toast("✓ Synced " + majors.length + " majors + " + minors.length + " minors to Liquid.", true); }
        });
      }
    } catch (e) { /* non-fatal */ }
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
          const ok = await driveNewAudit(item.name, item.level);
          if (ok) { chrome.runtime.sendMessage({ type: "lp-queue-done", name: item.name }); toast("✓ " + item.name + " audited & synced.", true); }
          else { toast("Couldn't auto-select “" + item.name + "”. Run it once manually and I'll capture it.", false); }
          await sleep(2500);
        } catch (e) { /* keep going with the rest of the queue */ }
      }
      queueRunning = false;
    });
  }

  // Initial import once the SPA renders, then watch for program changes.
  setTimeout(() => doImport(false), 2500);
  // Once the current audit is captured, process any programs the app queued.
  setTimeout(() => processQueue(false), 7000);
  // Sync the full program list to the app (only when not busy auto-auditing).
  setTimeout(() => { if (!queueRunning) syncCatalog(); }, 12000);

  // Re-check when the page content mutates (running a different program's audit
  // rewrites the same page), debounced. This is what captures each program.
  let t;
  const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => doImport(false), 1500); });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  // Safety net: also poll every 6s in case mutations are missed.
  setInterval(() => doImport(false), 6000);
})();
