const DARS_URL = "https://myplan.uw.edu/audit/#/degree";

chrome.runtime.sendMessage({ type: "lp-status" }, (s) => {
  const dot = document.getElementById("dot");
  const txt = document.getElementById("statusText");
  if (s && s.connected) {
    dot.className = "dot on"; txt.textContent = "Connected to your account";
    const a = document.getElementById("app");
    if (s.api) { a.href = s.api.replace(/\/api.*/, "").replace(/onrender\.com.*/, "onrender.com") || "#"; }
  } else {
    dot.className = "dot off"; txt.textContent = "Not connected — sign in to the app";
  }
});

document.getElementById("open").addEventListener("click", () => {
  chrome.tabs.create({ url: DARS_URL });
});

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
