import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// `vite build --mode anteprima`: build autocontenuta (font e immagini incorporati)
// usata per pubblicare l'anteprima condivisibile, vedi scripts/anteprima.mjs
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  build: mode === "anteprima" ? { outDir: "dist-anteprima", assetsInlineLimit: 100_000_000, cssCodeSplit: false } : undefined,
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
