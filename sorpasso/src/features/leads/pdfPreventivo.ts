/** Genera il PDF del preventivo (A4) con pdf-lib, lato client. */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { dataBreve, euroCent } from "@/lib/format";
import type { Organization, Quote } from "@/types/db";

export interface DatiPdf {
  org: Organization;
  cliente: { nome: string; telefono?: string | null; email?: string | null };
  auto: { descrizione: string; dettagli: string } | null;
  quote: Quote;
  venditore: string;
}

const BLU = rgb(0.059, 0.129, 0.278);
const ACCENTO = rgb(0.184, 0.42, 1);
const GRIGIO = rgb(0.36, 0.4, 0.47);

/** I font standard usano WinAnsi: niente spazi speciali di Intl né caratteri fuori set. */
const pulisci = (s: string) => s.replace(/[  ]/g, " ").replace(/[^\x20-\x7E -ÿ€–’]/g, "");

export async function generaPdfPreventivo(d: DatiPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Preventivo ${d.org.nome}`);
  pdf.setAuthor(d.org.nome);
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();
  const M = 50;
  let y = 790;

  const testo = (p: PDFPage, s: string, x: number, yy: number, f: PDFFont = font, size = 11, color = BLU) =>
    p.drawText(pulisci(s), { x, y: yy, size, font: f, color });
  const destra = (s: string, yy: number, f: PDFFont = font, size = 11, color = BLU) => {
    const t = pulisci(s);
    page.drawText(t, { x: width - M - f.widthOfTextAtSize(t, size), y: yy, size, font: f, color });
  };

  // Intestazione azienda
  page.drawRectangle({ x: 0, y: 812, width, height: 30, color: BLU });
  testo(page, d.org.nome, M, y - 10, bold, 18);
  const intestazione = [d.org.indirizzo, d.org.comune, d.org.piva && `P.IVA ${d.org.piva}`, d.org.telefono, d.org.email].filter(Boolean).join(" · ");
  if (intestazione) testo(page, intestazione, M, y - 28, font, 9, GRIGIO);
  destra("PREVENTIVO", y - 10, bold, 14, ACCENTO);
  destra(`del ${dataBreve(d.quote.created_at)}`, y - 28, font, 10, GRIGIO);
  y -= 70;

  // Cliente
  testo(page, "Cliente", M, y, bold, 10, GRIGIO);
  testo(page, d.cliente.nome, M, y - 16, bold, 13);
  const contatti = [d.cliente.telefono, d.cliente.email].filter(Boolean).join(" · ");
  if (contatti) testo(page, contatti, M, y - 32, font, 10, GRIGIO);
  y -= 60;

  // Auto
  if (d.auto) {
    page.drawRectangle({ x: M, y: y - 44, width: width - 2 * M, height: 56, color: rgb(0.92, 0.945, 1) });
    testo(page, "Auto", M + 12, y - 2, bold, 10, GRIGIO);
    testo(page, d.auto.descrizione, M + 12, y - 18, bold, 13);
    testo(page, d.auto.dettagli, M + 12, y - 34, font, 10, GRIGIO);
    y -= 76;
  }

  // Righe economiche
  const q = d.quote;
  const righe: [string, string, boolean?][] = [["Prezzo di vendita", euroCent(q.prezzo)]];
  if (q.sconto > 0) righe.push(["Sconto", `– ${euroCent(q.sconto)}`]);
  righe.push(["Prezzo finale auto", euroCent(q.totale), true]);
  if (q.permuta_valutata > 0) righe.push(["Valutazione permuta", `– ${euroCent(q.permuta_valutata)}`]);
  if (q.anticipo > 0) righe.push(["Anticipo", `– ${euroCent(q.anticipo)}`]);
  righe.push([q.finanziamento ? "Importo da finanziare" : "Saldo da pagare", euroCent(q.saldo), true]);

  for (const [etichetta, valore, forte] of righe) {
    page.drawLine({ start: { x: M, y: y - 8 }, end: { x: width - M, y: y - 8 }, thickness: 0.5, color: rgb(0.88, 0.9, 0.94) });
    testo(page, etichetta, M, y, forte ? bold : font, 12);
    destra(valore, y, forte ? bold : font, 12);
    y -= 28;
  }

  if (q.finanziamento && q.rata && q.durata_mesi) {
    y -= 8;
    page.drawRectangle({ x: M, y: y - 34, width: width - 2 * M, height: 46, color: BLU });
    page.drawText(pulisci(`${q.durata_mesi} rate mensili da`), { x: M + 14, y: y - 4, size: 11, font, color: rgb(1, 1, 1) });
    const rata = pulisci(euroCent(q.rata));
    page.drawText(rata, { x: width - M - 14 - bold.widthOfTextAtSize(rata, 20), y: y - 12, size: 20, font: bold, color: rgb(1, 1, 1) });
    if (q.tan != null)
      page.drawText(pulisci(`TAN ${q.tan.toLocaleString("it-IT")}% · esempio indicativo, soggetto ad approvazione della finanziaria`), {
        x: M + 14,
        y: y - 24,
        size: 8,
        font,
        color: rgb(0.8, 0.85, 0.95),
      });
    y -= 60;
  }

  if (q.note) {
    y -= 10;
    testo(page, "Note", M, y, bold, 10, GRIGIO);
    y -= 16;
    for (const riga of spezza(q.note, font, 10, width - 2 * M).slice(0, 8)) {
      testo(page, riga, M, y, font, 10);
      y -= 14;
    }
  }

  // Piè di pagina
  const scadenza = new Date(new Date(q.created_at).getTime() + 15 * 86_400_000);
  testo(page, `Offerta valida 15 giorni, fino al ${dataBreve(scadenza)}, salvo venduto. Prezzi IVA inclusa.`, M, 80, font, 9, GRIGIO);
  testo(page, `Il tuo consulente: ${d.venditore}`, M, 64, bold, 10);
  testo(page, "Firma per accettazione ____________________________", width - M - 260, 64, font, 10, GRIGIO);

  return pdf.save();
}

function spezza(testo: string, f: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  for (const par of pulisci(testo).split(/\n/)) {
    let riga = "";
    for (const parola of par.split(" ")) {
      const prova = riga ? `${riga} ${parola}` : parola;
      if (f.widthOfTextAtSize(prova, size) > max && riga) {
        out.push(riga);
        riga = parola;
      } else riga = prova;
    }
    out.push(riga);
  }
  return out;
}

/** Rata mensile con ammortamento alla francese. */
export function calcolaRata(importo: number, tanPercento: number, mesi: number): number {
  if (importo <= 0 || mesi <= 0) return 0;
  const i = tanPercento / 100 / 12;
  const r = i === 0 ? importo / mesi : (importo * i) / (1 - Math.pow(1 + i, -mesi));
  return Math.round(r * 100) / 100;
}
