import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

export type CertificateData = {
  codice: string;
  nome_intestatario: string;
  corso: string;
  academy: string;
  colore: string;
  docente: string | null;
  lezioni: number;
  durata_sec: number;
  rilasciato_il: string;
};

/** I font standard PDF coprono il Latin-1: sostituiamo quello che non sanno disegnare. */
export function pdfSafe(s: string) {
  return s
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function hexToRgb(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const n = parseInt(m ? m[1]! : "0042ed", 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Riduce la dimensione finché il testo sta nella larghezza data. */
function fit(font: PDFFont, text: string, size: number, maxWidth: number, min = 12) {
  let s = size;
  while (s > min && font.widthOfTextAtSize(text, s) > maxWidth) s -= 1;
  return s;
}

function centered(
  page: PDFPage,
  font: PDFFont,
  text: string,
  y: number,
  size: number,
  color = rgb(0.11, 0.13, 0.14),
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font, color });
}

export function formatHours(sec: number) {
  if (sec <= 0) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

/** Attestato A4 orizzontale con codice e QR per la verifica pubblica. */
export async function buildCertificatePdf(d: CertificateData, verifyUrl: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`Attestato - ${d.corso}`));
  pdf.setAuthor(pdfSafe(d.academy));
  pdf.setCreator("Christian Prete Academy");
  const page = pdf.addPage([841.89, 595.28]);
  const W = page.getWidth();
  const H = page.getHeight();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = hexToRgb(d.colore);
  const muted = rgb(0.42, 0.45, 0.5);
  const dark = rgb(0.11, 0.13, 0.14);

  // Cornice e fascia colorata
  page.drawRectangle({ x: 0, y: H - 14, width: W, height: 14, color: accent });
  page.drawRectangle({
    x: 28,
    y: 28,
    width: W - 56,
    height: H - 70,
    borderColor: rgb(0.87, 0.88, 0.9),
    borderWidth: 1,
  });

  centered(page, bold, pdfSafe(d.academy.toUpperCase()), H - 78, 14, accent);
  centered(page, regular, "ATTESTATO DI COMPLETAMENTO", H - 130, 13, muted);
  centered(page, regular, "Si attesta che", H - 185, 14, muted);

  const nome = pdfSafe(d.nome_intestatario);
  centered(page, bold, nome, H - 235, fit(bold, nome, 38, W - 160), dark);

  centered(page, regular, "ha completato il corso", H - 280, 14, muted);
  const corso = pdfSafe(d.corso);
  centered(page, bold, corso, H - 320, fit(bold, corso, 24, W - 160), dark);

  const ore = formatHours(d.durata_sec);
  const dettagli = [`${d.lezioni} lezioni`, ore, d.docente ? `docente ${d.docente}` : null]
    .filter(Boolean)
    .join("  ·  ");
  centered(page, regular, pdfSafe(dettagli), H - 352, 12, muted);

  const data = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  }).format(new Date(d.rilasciato_il));
  page.drawText(pdfSafe(`Rilasciato il ${data}`), {
    x: 70,
    y: 110,
    size: 12,
    font: regular,
    color: dark,
  });
  page.drawText(`Codice ${d.codice}`, { x: 70, y: 90, size: 12, font: bold, color: dark });
  page.drawText(pdfSafe(`Verifica: ${verifyUrl}`), {
    x: 70,
    y: 70,
    size: 9,
    font: regular,
    color: muted,
  });

  // QR per la verifica
  const qr = await QRCode.toBuffer(verifyUrl, { margin: 0, width: 240, errorCorrectionLevel: "M" });
  const img = await pdf.embedPng(qr);
  page.drawImage(img, { x: W - 70 - 90, y: 62, width: 90, height: 90 });

  return pdf.save();
}
