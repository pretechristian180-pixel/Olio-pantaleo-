// Crea dist-anteprima/mattonio.html: un unico file con CSS e JS incorporati,
// pronto da pubblicare come pagina di anteprima.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "dist-anteprima/assets";
const files = readdirSync(dir);
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
const js = files.filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");

const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mattonio</title>
<meta name="theme-color" content="#ffffff">
<style>${css.replace(/<\/style/gi, "<\\/style")}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>
</body>
</html>
`;
writeFileSync("dist-anteprima/mattonio.html", html);
console.log(`mattonio.html: ${(html.length / 1024).toFixed(0)} KB`);
