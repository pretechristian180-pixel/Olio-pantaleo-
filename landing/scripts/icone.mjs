// Genera icone.js: le icone lucide usate dalla landing, come SVG in linea
// (nessuna libreria da caricare). Uso: node scripts/icone.mjs <cartella icons di lucide>
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const names = [
  "menu", "x", "check", "chevron-down", "arrow-right", "circle-play", "smartphone", "zap", "calendar-check",
  "hourglass", "user-x", "archive", "message-circle-reply", "users-round", "file-chart-column", "trending-down",
  "file-clock", "house", "contact-round", "kanban", "calendar-days", "key-round", "shield-check", "video",
  "megaphone", "quote", "mail", "phone", "map-pin", "circle-check", "sparkles", "upload", "settings-2", "coffee",
];
const out = {};
for (const n of names) {
  const { __iconData } = await import(join(dir, `${n}.mjs`));
  const arr = __iconData.node;
  out[n] = arr
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
}
writeFileSync(
  "icone.js",
  `// Icone lucide (licenza ISC) generate da scripts/icone.mjs\nwindow.ICONE = ${JSON.stringify(out, null, 0)};\n`,
);
console.log(Object.keys(out).length, "icone");
