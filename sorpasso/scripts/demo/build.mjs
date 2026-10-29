/**
 * Costruisce la demo in un unico file HTML (dati registrati incorporati, nessun backend).
 * Uso (dalla cartella sorpasso, dopo registra.cjs):
 *   node scripts/demo/build.mjs scripts/demo/registrazioni.json scripts/demo/meta.json dist-demo/sorpasso-demo.html
 */
import fs from "node:fs";
import path from "node:path";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const [registrazioni, metaFile, uscita = "dist-demo/sorpasso-demo.html"] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
fs.copyFileSync(registrazioni, "src/demo/registrazioni.json");
const out = path.resolve("dist-demo/build");

await build({
  configFile: false, root: process.cwd(), base: "./", logLevel: "error",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve("src") } },
  define: {
    "import.meta.env.VITE_DEMO": JSON.stringify("1"),
    "import.meta.env.VITE_DEMO_ORA": JSON.stringify(String(meta.ora)),
    "import.meta.env.VITE_DEMO_UTENTE_ID": JSON.stringify(meta.utente),
  },
  build: {
    outDir: out, emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false,
    rollupOptions: { output: { codeSplitting: false } },
  },
});

const assets = fs.readdirSync(path.join(out, "assets"));
let js = fs.readFileSync(path.join(out, "assets", assets.find((f) => f.endsWith(".js"))), "utf8");
let css = fs.readFileSync(path.join(out, "assets", assets.find((f) => f.endsWith(".css"))), "utf8");
for (const n of ["chiaro", "scuro"]) {
  const uri = "data:image/png;base64," + fs.readFileSync(path.join(out, `logo-${n}.png`)).toString("base64");
  js = js.replaceAll(`\`/logo-${n}.png\``, `\`${uri}\``);
}
js = js.replaceAll("</script", "<\\/script").replaceAll("�", "\\uFFFD");
css = css.replaceAll("</style", "<\\/style");
fs.writeFileSync(uscita, `<title>Sorpasso AI demo</title>
<meta name="description" content="Versione dimostrativa del gestionale Sorpasso AI con dati di esempio.">
<style>${css}
html,body{background-color:#f4f6fa;color:#0d1526;color-scheme:light}</style>
<div id="root"></div>
<script type="module">${js}</script>
`);
console.log("Demo pronta:", uscita, Math.round(fs.statSync(uscita).size / 1024), "KB");
