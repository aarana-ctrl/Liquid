// Runs on the UW MyPlan DARS audit page. Reads the rendered audit text and
// sends it to Liquid to import — automatically on load, on demand from the
// popup, AND every time you run a *different* program's audit ("Audit a
// different program"). Each program you open is captured, so Compare mode has
// the exact, per-category numbers for every major/minor you audit.
(function () {
  function looksLikeDars(t) { return /Audit a UW Degree Program|Earned:\s*\d+\s*credits|DEGREE REQUIREMENTS/i.test(t); }

  // The program the audit shows — a bachelor's MAJOR or a MINOR. Matching both is
  // essential: without the minor case, minor audits produce an empty program name
  // and doImport() skips them, so minor DARS data never reaches Liquid.
  function progMatch(t) {
    return t.match(/BACHELOR OF (?:SCIENCE|ARTS) \(([^)]+)\)/i)
      || t.match(/\bMINOR\s*\(\s*([^)\n]{2,60}?)\s*\)/i)                                                  // MINOR (NAME)
      || t.match(/\bMINOR(?:\s+IN)?\s*([A-Z][A-Za-z0-9 &,'.\/-]{2,60}?)\s*(?:\n|\r|Catalog|Prepared|Requirements)/i); // MINOR [IN] NAME
  }
  // A fingerprint of the audit currently on screen, so we only re-import when it
  // actually changes (different program, or refreshed numbers).
  function signature(t) {
    const prog = (progMatch(t) || [])[1] || "";
    const cr = (t.match(/Earned:\s*(\d+)\s*credits\s*In-progress:\s*(\d+)\s*credits\s*Needs:\s*(\d+)\s*credits/i) || []).slice(1).join("-");
    return (prog + "|" + cr).trim();
  }
  function programName(t) {
    const p = (progMatch(t) || [])[1];
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
    // "Meaningful" = a real audit is on screen: a recognized program name OR an
    // "Earned: N credits" summary. Crucially this does NOT require the program-name
    // regex to match, so a minor audit still imports even if its header wording is
    // unusual — the backend parser extracts the minor name from the full text.
    const meaningful = !!((progMatch(text) || [])[1]) || /Earned:\s*\d+\s*credit/i.test(text);
    if (!manual && (busy || sig === lastSig || !meaningful)) return; // nothing new
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

  function findPickerButton() {
    return [...document.querySelectorAll("button, a, [role=button]")]
      .find((e) => /choose (a )?different program|different program|change program|audit (a )?different|audit another|new audit|change your program|select (a )?program|different degree/i
        .test((e.textContent || e.getAttribute("aria-label") || "").trim()));
  }
  async function openPicker() {
    if (document.querySelector("#programSelector")) return true;
    // Reopening the picker is the failure point for the 2nd+ audit in a batch:
    // after an audit renders, the selector is gone and the "different program"
    // control may be worded differently. Try the button, and if that fails, reset
    // the audit SPA back to the degree-selection route. Retry a few times.
    for (let attempt = 0; attempt < 4; attempt++) {
      if (document.querySelector("#programSelector")) return true;
      const btn = findPickerButton();
      if (btn) { btn.click(); }
      else if (/myplan\.uw\.edu\/audit/i.test(location.href)) { try { location.hash = "#/degree"; } catch (e) { /* */ } }
      for (let i = 0; i < 16; i++) { await sleep(400); if (document.querySelector("#programSelector")) return true; }
    }
    return !!document.querySelector("#programSelector");
  }

  // Acronym of a program name (first letter of significant words) so a full name
  // matches a picker option abbreviated in MyPlan (e.g. "Applied & Computational
  // Math Sciences" ↔ "ACMS"), and vice versa.
  const acr = (s) => String(s || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(bachelor|of|science|arts|minor|major|the|in|and|for|bs|ba)\b/gi, " ")
    .split(/[^a-z0-9]+/i).filter(Boolean).map((w) => w[0]).join("").toLowerCase();
  const compact = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  function matchOption(select, name) {
    const target = norm(name);
    const nameAcr = acr(name);
    const opts = [...select.options].filter((o) => o.value && !/select a program/i.test(o.textContent));
    return opts.find((o) => norm(o.textContent) === target)
      || opts.find((o) => { const t = norm(o.textContent); return t && (t.includes(target) || target.includes(t)); })
      // acronym / abbreviation match, both directions
      || opts.find((o) => { const oa = acr(o.textContent), oc = compact(o.textContent);
           return nameAcr.length >= 2 && (nameAcr === oa || oc === nameAcr || compact(name).length >= 2 && oa === compact(name)); })
      || null;
  }

  // Detect the UW WebLogin page (expired session) — the audit can't run there.
  function looksLikeLogin() {
    const t = document.body.innerText || "";
    return /Sign in to start using UW MyPlan|WEBLOGIN|Already have a UW NetID/i.test(t) &&
      !/Audit a UW Degree Program|BACHELOR OF|MINOR IN|MINOR \(/i.test(t);
  }
  // The program the audit is currently showing (normalized), or null while loading.
  function renderedProgram() {
    const m = progMatch(document.body.innerText || "");
    return m ? norm(m[1]) : null;
  }

  // Returns true (audited+imported), false (couldn't), or "login" (session expired).
  async function driveNewAudit(name, level) {
    if (looksLikeLogin()) return "login";
    if (!(await openPicker())) return looksLikeLogin() ? "login" : false;
    const type = document.querySelector("#degreeTypeSelector");
    if (!type) return looksLikeLogin() ? "login" : false;
    const wantMinor = level === "minor";
    const typeOpt = [...type.options].find((o) => wantMinor ? /minor/i.test(o.textContent) : /major/i.test(o.textContent));
    // Changing Major↔Minor asynchronously re-populates the program list. Majors are
    // the default so they're ready immediately, but a minor needs the list to reload
    // — so poll for the target option to appear instead of a fixed wait.
    if (typeOpt && type.value !== typeOpt.value) { setNativeSelect(type, typeOpt.value); }
    let opt = null, prog = null;
    for (let i = 0; i < 22; i++) { // up to ~9s for the minor list to populate
      prog = document.querySelector("#programSelector");
      if (prog) { opt = matchOption(prog, name); if (opt) break; }
      await sleep(400);
    }
    if (!prog || !opt) return false; // fail safe — never guess-click
    setNativeSelect(prog, opt.value);
    await sleep(700);
    const run = [...document.querySelectorAll("button, a, input[type=submit]")]
      .find((b) => /audit your degree/i.test(b.textContent || b.value || ""));
    if (!run) return false;
    const want = norm(name);
    const beforeSig = signature(document.body.innerText || "");
    run.click();
    // The audit generates asynchronously (~10–25s). Consider it ready when the audit
    // content actually changed AND the requested program is what's now shown — either
    // by its header (renderedProgram) OR by the picker having closed onto an audit
    // that names it. This second path works even if the minor header wording is
    // unusual. Never import on timeout — that would capture the previous program.
    for (let i = 0; i < 45; i++) {
      await sleep(1500);
      if (looksLikeLogin()) return "login";
      const t = document.body.innerText || "";
      if (!looksLikeDars(t)) continue;
      const rp = renderedProgram();
      const headerMatch = rp && (rp.includes(want) || want.includes(rp));
      const sig = signature(t);
      const pickerClosed = !document.querySelector("#programSelector");
      const nameShown = pickerClosed && sig !== beforeSig && norm(t).includes(want);
      if (headerMatch || nameShown) { await sleep(1500); doImport(false); return true; }
    }
    return false; // timed out without the right audit rendering — don't import wrong data
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

  const getQueue = () => new Promise((res) => chrome.runtime.sendMessage({ type: "lp-queue" }, (r) => res((r && r.ok && r.queue) || [])));

  let queueRunning = false;
  async function processQueue(manual) {
    if (queueRunning) return;
    const first = await getQueue();
    if (!first.length) {
      if (manual) toast("No programs queued for auto-audit.", true);
      chrome.runtime.sendMessage({ type: "lp-queue-processed" }); // nothing to do → let the hidden tab close
      return;
    }
    queueRunning = true;
    toast("Auto-running DARS for " + first.length + " program" + (first.length > 1 ? "s" : "") + "…", true);
    // Drain the queue one at a time, re-checking each pass so programs queued
    // while we were running are also handled. Remove each item whether it
    // succeeds or fails, so the queue always empties and the tab can close.
    let guard = 0;
    while (guard++ < 80) {
      const q = await getQueue();
      if (!q.length) break;
      const item = q[0];
      // Try each program up to twice; the 2nd+ audit in a batch sometimes needs the
      // picker re-opened from a fresh state (openPicker handles that).
      let res = false;
      for (let tryN = 0; tryN < 2 && res !== true; tryN++) {
        if (tryN > 0) await sleep(1500);
        try { res = await driveNewAudit(item.name, item.level); } catch (e) { res = false; }
        if (res === "login") break;
      }
      if (res === "login") {
        // Only abort the whole batch if the session is REALLY gone — re-check after a
        // moment so a transient loading state doesn't wrongly stop the remaining ones.
        await sleep(2500);
        if (looksLikeLogin()) {
          toast("Your UW MyPlan sign-in expired. Sign into MyPlan, then it finishes automatically.", false);
          break;
        }
        continue; // false alarm — retry this item on the next pass
      }
      chrome.runtime.sendMessage({ type: "lp-queue-done", name: item.name });
      toast(res ? ("✓ " + item.name + " audited & synced.") : ("Couldn't auto-run “" + item.name + "” — skipped."), !!res);
      await sleep(2200);
    }
    queueRunning = false;
    chrome.runtime.sendMessage({ type: "lp-queue-processed" }); // queue drained → hidden tab closes
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
