// Crea dist/anteprima.html: la landing in un solo file, adatta a essere pubblicata come anteprima.
// - icone incorporate (nessun file esterno)
// - il form non invia dati: dall'anteprima Supabase non è raggiungibile, quindi mostra solo la conferma
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

let html = readFileSync("index.html", "utf8");
const icone = readFileSync("icone.js", "utf8");

// Solo il contenuto: la pagina di anteprima aggiunge da sé doctype, head e body
const head = html.slice(html.indexOf("<head>") + 6, html.indexOf("</head>"));
const body = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
// Nome della pagina di anteprima (il sito vero tiene il meta title completo)
const title = "<title>Landing Mattonio</title>";
const fonts = head.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/)[0];
const style = head.slice(head.indexOf("<style>"), head.indexOf("</style>") + 8);

let corpo = body
  .replace('<script src="icone.js"></script>', `<script>${icone}</script>`)
  .replace("var ANTEPRIMA = false;", "var ANTEPRIMA = true;");

const out = `${title}
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
${style}
${corpo}`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/anteprima.html", out);
console.log(`dist/anteprima.html: ${(out.length / 1024).toFixed(0)} KB`);
