import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the built dist/index.html openable directly from the file system
export default defineConfig({
  plugins: [react()],
  base: "./",
});
