import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the built bundle also works from file:// inside Capacitor.
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
