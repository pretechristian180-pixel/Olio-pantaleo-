/**
 * Scheda tecnica PDF (A4, una pagina) da stampare o inviare al cliente.
 * Contiene solo dati pubblicabili: mai costi, difetti, note interne, targa o telaio.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { firmaFoto } from "@/lib/storage";
import { TIPI_VEICOLO } from "@/lib/labels";
import { datiChiave, optionalRaggruppati } from "./datiAuto";
import type { Organization, VehicleView } from "@/types/db";

const NAVY = rgb(0.059, 0.129, 0.278);
const ACCENTO = rgb(0.184, 0.42, 1);
const GRIGIO = rgb(0.36, 0.4, 0.47);
const LINEA = rgb(0.9, 0.91, 0.94);
const W = 595.28;
const H = 841.89;
const M = 40;

// Caratteri extra di WinAnsi (Helvetica standard) oltre al Latin-1
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Rende il testo stampabile con i font standard: spazi speciali normalizzati, emoji e simboli non supportati rimossi. */
export function testoPdf(s: string): string {
  return s
    .replace(/[   ]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/\r?\n/g, " ")
    .split("")
    .filter((c) => {
      const n = c.charCodeAt(0);
      return (n >= 32 && n <= 126) || (n >= 160 && n <= 255) || WINANSI_EXTRA.includes(c);
    })
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const euro = (n: number) => testoPdf(new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n));

/** Carica un'immagine qualsiasi (anche WebP/SVG) e la converte via canvas in PNG o JPEG, ridimensionata. */
async function immagineInBytes(url: string, tipo: "image/png" | "image/jpeg", maxLato: number): Promise<Uint8Array | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();
    const scala = Math.min(1, maxLato / Math.max(img.naturalWidth || maxLato, img.naturalHeight || maxLato));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((img.naturalWidth || maxLato) * scala));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || maxLato) * scala));
    const ctx = canvas.getContext("2d")!;
    if (tipo === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, tipo, 0.86));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

function spezza(testo: string, font: PDFFont, size: number, larghezza: number): string[] {
  const righe: string[] = [];
  let corrente = "";
  for (const parola of testo.split(" ")) {
    const prova = corrente ? `${corrente} ${parola}` : parola;
    if (font.widthOfTextAtSize(prova, size) > larghezza && corrente) {
      righe.push(corrente);
      corrente = parola;
    } else corrente = prova;
  }
  if (corrente) righe.push(corrente);
  return righe;
}

/** Testo su una riga, accorciato con "…" se troppo lungo. */
function scriviRiga(page: PDFPage, testo: string, x: number, y: number, font: PDFFont, size: number, max: number, color = NAVY) {
  let t = testoPdf(testo);
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > max) t = `${t.slice(0, -2)}…`;
  page.drawText(t, { x, y, size, font, color });
}

/** Disegna l'immagine adattandola al riquadro senza deformarla, centrata. */
function disegnaContenuta(page: PDFPage, img: PDFImage, x: number, y: number, w: number, h: number) {
  const r = Math.min(w / img.width, h / img.height);
  const dw = img.width * r;
  const dh = img.height * r;
  page.drawImage(img, { x: x + (w - dw) / 2, y: y + (h - dh) / 2, width: dw, height: dh });
}

export async function generaSchedaPdf(v: VehicleView, org: Organization, link: string): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(testoPdf(`${v.marca} ${v.modello} - ${org.nome}`));
  pdf.setAuthor(testoPdf(org.nome));
  const page = pdf.addPage([W, H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ---- Intestazione: logo o nome del salone ----
  let y = H - M;
  const logoBytes = org.logo_url ? await immagineInBytes(org.logo_url, "image/png", 600) : null;
  if (logoBytes) {
    const logo = await pdf.embedPng(logoBytes);
    disegnaContenuta(page, logo, M, y - 42, 170, 42);
  } else {
    scriviRiga(page, org.nome, M, y - 26, bold, 18, 300);
  }
  const contattiTop = [org.telefono && `Tel. ${org.telefono}`, org.email].filter(Boolean).join("  ·  ");
  if (contattiTop) {
    const t = testoPdf(contattiTop);
    const size = 9;
    page.drawText(t, { x: W - M - font.widthOfTextAtSize(t, size), y: y - 26, size, font, color: GRIGIO });
  }
  y -= 58;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINEA });

  // ---- Titolo ----
  y -= 30;
  scriviRiga(page, `${v.marca} ${v.modello}`, M, y, bold, 24, W - 2 * M);
  y -= 18;
  scriviRiga(page, [v.versione, v.allestimento].filter(Boolean).join(" · ") || TIPI_VEICOLO[v.tipo], M, y, font, 12, W - 2 * M, GRIGIO);

  // ---- Foto principale (sinistra) + prezzo e QR (destra) ----
  y -= 16;
  const fotoW = 330;
  const fotoH = 200;
  const fotoY = y - fotoH;
  page.drawRectangle({ x: M, y: fotoY, width: fotoW, height: fotoH, color: rgb(0.93, 0.95, 0.99) });
  if (v.foto_copertina) {
    const [firmata] = await firmaFoto([v.foto_copertina], 300).catch(() => []);
    const bytes = firmata?.signedUrl ? await immagineInBytes(firmata.signedUrl, "image/jpeg", 1400) : null;
    if (bytes) {
      const foto = await pdf.embedJpg(bytes);
      disegnaContenuta(page, foto, M, fotoY, fotoW, fotoH);
    }
  } else {
    const t = testoPdf(v.marca.toUpperCase());
    page.drawText(t, { x: M + (fotoW - bold.widthOfTextAtSize(t, 20)) / 2, y: fotoY + fotoH / 2 - 7, size: 20, font: bold, color: ACCENTO });
  }

  const colX = M + fotoW + 22;
  const colW = W - M - colX;
  let cy = y - 4;
  page.drawText("Prezzo", { x: colX, y: cy - 10, size: 10, font, color: GRIGIO });
  cy -= 40;
  if (v.prezzo_vendita != null) scriviRiga(page, euro(v.prezzo_vendita), colX, cy, bold, 28, colW, ACCENTO);
  else scriviRiga(page, "Prezzo su richiesta", colX, cy, bold, 16, colW, ACCENTO);
  cy -= 18;
  scriviRiga(page, `${new Intl.NumberFormat("it-IT").format(v.km)} km${v.anno ? `  ·  ${v.anno}` : ""}`, colX, cy, font, 11, colW, GRIGIO);

  const qrPng = await QRCode.toDataURL(link, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#0f2147", light: "#ffffff" } });
  const qr = await pdf.embedPng(qrPng);
  const qrSize = 104;
  const qrY = fotoY + 26;
  page.drawImage(qr, { x: colX, y: qrY, width: qrSize, height: qrSize });
  const didascalia = spezza("Inquadra il codice per vedere tutte le foto e contattarci", font, 8.5, colW - qrSize - 10);
  didascalia.forEach((r, i) => page.drawText(r, { x: colX + qrSize + 10, y: qrY + qrSize - 14 - i * 11, size: 8.5, font, color: GRIGIO }));
  scriviRiga(page, link.replace(/^https?:\/\//, ""), colX, fotoY + 8, font, 7.5, colW, GRIGIO);

  y = fotoY - 26;

  // ---- Dati principali in griglia a 3 colonne ----
  page.drawText("Dati principali", { x: M, y, size: 13, font: bold, color: NAVY });
  y -= 18;
  const dati = datiChiave(v);
  const colonne = 3;
  const cellW = (W - 2 * M) / colonne;
  dati.forEach((d, i) => {
    const cx = M + (i % colonne) * cellW;
    const ry = y - Math.floor(i / colonne) * 26;
    page.drawText(testoPdf(d.etichetta), { x: cx, y: ry, size: 8.5, font, color: GRIGIO });
    scriviRiga(page, d.valore, cx, ry - 12, bold, 10.5, cellW - 10);
  });
  y -= Math.ceil(dati.length / colonne) * 26 + 6;

  // ---- Optional raggruppati, fin dove c'è spazio ----
  const fondo = M + 50;
  const gruppi = optionalRaggruppati(v);
  if (gruppi.length && y > fondo + 40) {
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 1, color: LINEA });
    y -= 12;
    page.drawText("Optional ed equipaggiamenti", { x: M, y, size: 13, font: bold, color: NAVY });
    y -= 18;
    const totale = gruppi.reduce((n, g) => n + g.voci.length, 0);
    let scritti = 0;
    let finito = false;
    for (const g of gruppi) {
      if (y < fondo + 24) break;
      page.drawText(testoPdf(g.categoria), { x: M, y, size: 9, font: bold, color: ACCENTO });
      y -= 12;
      const righe = spezza(g.voci.map(testoPdf).join("  ·  "), font, 9, W - 2 * M);
      for (const r of righe) {
        if (y < fondo + 12) {
          finito = true;
          break;
        }
        page.drawText(r, { x: M, y, size: 9, font, color: NAVY });
        scritti += r.split("  ·  ").length;
        y -= 11.5;
      }
      if (finito) break;
      y -= 4;
    }
    const resto = totale - scritti;
    if (resto > 0) page.drawText(testoPdf(`+${resto} altri equipaggiamenti: guarda la scheda online`), { x: M, y: Math.max(y, fondo), size: 9, font, color: GRIGIO });
  }

  // ---- Piè di pagina: contatti del salone ----
  page.drawRectangle({ x: 0, y: 0, width: W, height: M + 34, color: NAVY });
  scriviRiga(page, org.nome, M, M + 10, bold, 12, W - 2 * M, rgb(1, 1, 1));
  const contatti = [
    [org.indirizzo, org.comune].filter(Boolean).join(", "),
    org.telefono && `Tel. ${org.telefono}`,
    org.whatsapp && `WhatsApp ${org.whatsapp}`,
    org.email,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (contatti) scriviRiga(page, contatti, M, M - 6, font, 9, W - 2 * M, rgb(0.79, 0.83, 0.9));
  page.drawText(testoPdf("Dati e prezzo indicativi, soggetti a verifica in sede."), { x: M, y: 14, size: 7, font, color: rgb(0.6, 0.65, 0.75) });

  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
