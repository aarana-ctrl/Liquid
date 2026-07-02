const DARS_URL = "https://myplan.uw.edu/audit/#/degree";
const dot = document.getElementById("dot");
const txt = document.getElementById("statusText");
const result = document.getElementById("testResult");

function refreshStatus() {
  chrome.runtime.sendMessage({ type: "lp-status" }, (s) => {
    if (s && s.connected) {
      dot.className = "dot on"; txt.textContent = "Connected · " + (s.api || "");
      const a = document.getElementById("app");
      if (s.api) a.href = s.api.replace(/\/api.*/, "");
    } else if (s && s.api) {
      dot.className = "dot warn"; txt.textContent = "Backend set, not signed in";
    } else {
      dot.className = "dot off"; txt.textContent = "Not connected — sign in to Liquid";
    }
    if (s && s.override) document.getElementById("apiInput").value = s.override;
  });
}
refreshStatus();

function runTest() {
  result.className = ""; result.textContent = "Testing…";
  chrome.runtime.sendMessage({ type: "lp-test" }, (r) => {
    if (r && r.ok) { result.className = "good"; result.textContent = "✓ Backend reachable and you're signed in (" + (r.who || "ok") + ")."; }
    else { result.className = "bad"; result.textContent = "✕ " + (r ? r.detail : "test failed"); }
    refreshStatus();
  });
}

document.getElementById("test").addEventListener("click", runTest);

document.getElementById("saveApi").addEventListener("click", () => {
  const api = document.getElementById("apiInput").value.trim();
  chrome.runtime.sendMessage({ type: "lp-set-api", api }, () => { runTest(); });
});

document.getElementById("open").addEventListener("click", () => chrome.tabs.create({ url: DARS_URL }));

document.getElementById("sync").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && /myplan\.uw\.edu\/audit/.test(tab.url || "")) {
      chrome.tabs.sendMessage(tab.id, { type: "lp-do-import" });
      window.close();
    } else {
      chrome.tabs.create({ url: DARS_URL });
    }
  });
});
