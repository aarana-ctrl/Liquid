import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Catch any render crash so the app never shows a blank white page — the user
// gets a readable error + a one-click reload instead of nothing.
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { try { console.error("Liquid crashed:", err, info); } catch { /* */ } }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "-apple-system, system-ui, sans-serif", color: "#e8ecff", background: "#0a0e22" }}>
          <div style={{ maxWidth: 460, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🌊</div>
            <h2 style={{ margin: "0 0 8px" }}>Something went wrong loading Liquid.</h2>
            <p style={{ color: "#a9b0d2", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
              This is usually a stale cache. Reload to recover — your plan and data are saved.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => window.location.reload()} style={{ border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", background: "linear-gradient(135deg, #8b7bf0, #6aa8ff)" }}>Reload</button>
              <button onClick={() => { try { localStorage.removeItem("lp_plan"); } catch { /* */ } window.location.reload(); }} style={{ border: "1px solid rgba(255,255,255,.2)", borderRadius: 12, padding: "11px 20px", fontSize: 14, fontWeight: 650, color: "#cfd6f5", background: "transparent", cursor: "pointer" }}>Reset local plan &amp; reload</button>
            </div>
            <pre style={{ marginTop: 18, textAlign: "left", fontSize: 11, color: "#7a82ad", whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>{String(this.state.err && (this.state.err.stack || this.state.err.message || this.state.err))}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
