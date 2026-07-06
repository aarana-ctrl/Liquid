import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The Chrome extension lives at ../extension and is shipped inside the built site
// (so it can be downloaded/loaded from there). Vite empties the output dir on
// every build, which would delete it — so re-copy it into the output after each
// build, regardless of how the build was invoked (npm script or raw `vite build`).
function copyExtension() {
  let outDir;
  return {
    name: "copy-liquid-extension",
    apply: "build",
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const dest = resolve(outDir, "liquid-myplan-extension");
      try {
        // Clear any stale copy first — an existing dir with restrictive perms
        // makes cpSync fail with EACCES, which would leave a broken extension.
        rmSync(dest, { recursive: true, force: true });
        cpSync(resolve(__dirname, "../extension"), dest, { recursive: true });
        // eslint-disable-next-line no-console
        console.log(`[copy-liquid-extension] extension copied → ${outDir}/liquid-myplan-extension`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[copy-liquid-extension] copy failed:", e.message);
      }
    },
  };
}

// On Vercel (and any web host) serve from the domain root: base "/".
// Locally we use "./" so the built index.html can be opened directly from disk.
export default defineConfig({
  plugins: [react(), copyExtension()],
  base: process.env.VERCEL ? "/" : "./",
});
