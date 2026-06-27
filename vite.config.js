import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// On Vercel (and any web host) serve from the domain root: base "/".
// Locally we use "./" so the built index.html can be opened directly from disk.
export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? "/" : "./",
});
