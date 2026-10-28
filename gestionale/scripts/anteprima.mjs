// Crea dist-anteprima/casalista.html: un unico file con CSS e JS incorporati,
// pronto da pubblicare come pagina di anteprima.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "dist-anteprima/assets";
const files = readdirSync(dir);
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
const js = files.filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");

const html = `<title>Casalista</title>
<meta name="theme-color" content="#ffffff">
<style>${css.replace(/<\/style/gi, "<\\/style")}</style>
<div id="root"></div>
<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>
`;
writeFileSync("dist-anteprima/casalista.html", html);
console.log(`casalista.html: ${(html.length / 1024).toFixed(0)} KB`);
