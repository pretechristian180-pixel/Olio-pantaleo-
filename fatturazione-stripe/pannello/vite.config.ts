import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // il pannello importa la validazione condivisa con le Edge Functions
  server: { fs: { allow: [".."] } },
});
