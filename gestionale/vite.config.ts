import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Porta 3000: è l'indirizzo predefinito (Site URL) dei link nelle email di Supabase Auth.
// `--mode anteprima` crea la pagina di anteprima pubblicata: stesso codice dell'app,
// ma dati di esempio in memoria al posto di Supabase (vedi src/demo) e file unico autocontenuto.
export default defineConfig(({ mode }) => {
  const anteprima = mode === "anteprima";
  const src = (p: string) => path.resolve(__dirname, "./src", p);
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 3000 },
    preview: { port: 3000 },
    resolve: {
      alias: [
        ...(anteprima
          ? [
              { find: "@/services/api", replacement: src("demo/api.ts") },
              { find: "@/services/admin", replacement: src("demo/admin.ts") },
              { find: "@/services/studio", replacement: src("demo/studio.ts") },
              { find: "@/services/acquisitions", replacement: src("demo/acquisitions.ts") },
              { find: "@/lib/supabase", replacement: src("demo/supabase.ts") },
            ]
          : []),
        { find: "@", replacement: src("") },
      ],
    },
    build: anteprima
      ? {
          outDir: "dist-anteprima",
          assetsInlineLimit: 100_000_000,
          cssCodeSplit: false,
          // Un solo file JS: anche i moduli caricati al bisogno (es. il PDF del consenso) finiscono nella pagina
          rolldownOptions: { output: { codeSplitting: false } },
        }
      : undefined,
  };
});
