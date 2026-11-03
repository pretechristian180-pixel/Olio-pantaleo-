// Impaginazione del report per il proprietario (A4). Solo dati già raccolti: nessun nome di visitatore.
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

// deno-lint-ignore no-explicit-any
type Dati = Record<string, any>;
export interface Immagini {
  foto?: Uint8Array | null;
  logo?: { bytes: Uint8Array; tipo: "png" | "jpg" } | null;
}

const NAVY = rgb(0x16 / 255, 0x20 / 255, 0x2e / 255);
const BRICK = rgb(0xc4 / 255, 0x53 / 255, 0x2f / 255);
const IVORY = rgb(0xf6 / 255, 0xf4 / 255, 0xf0 / 255);
const GREY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.87, 0.85, 0.82);
const GREEN = rgb(0.16, 0.55, 0.33);
const AMBER = rgb(0.8, 0.55, 0.1);
const W = 595.28;
const H = 841.89;
const M = 40;

// I font standard del PDF scrivono solo i caratteri WinAnsi (accenti italiani ed € compresi)
const EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const pulisci = (s: unknown) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[\t\r]/g, " ")
    .split("")
    .map((c) => {
      const n = c.charCodeAt(0);
      return c === "\n" || (n >= 32 && n < 127) || (n >= 160 && n <= 255) || EXTRA.includes(c) ? c : "?";
    })
    .join("");

const migliaia = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const euro = (n: number) => `€ ${migliaia(n)}`;
const data = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" });
const dataBreve = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long" });
const intenzioni: Record<string, string> = {
  proposta: "Vuole fare una proposta",
  ci_pensa: "Ci sta pensando",
  altro_immobile: "Preferisce un altro immobile",
  non_interessato: "Non interessato",
};
const prezzi: Record<string, string> = { basso: "Prezzo basso", giusto: "Prezzo giusto", alto: "Prezzo alto" };

export async function creaPdf(r: { dati: Dati; commento: string | null; portali: Record<string, number>; creato: string }, img: Immagini = {}) {
  const d = r.dati;
  const doc = await PDFDocument.create();
  doc.setTitle(pulisci(`Report ${d.immobile?.indirizzo ?? ""}`));
  doc.setAuthor(pulisci(d.agenzia?.nome ?? "Mattonio"));
  doc.setCreator("Mattonio");
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const b = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H;

  const testo = (t: string, x: number, yy: number, size: number, font: PDFFont = f, color = NAVY) =>
    page.drawText(pulisci(t), { x, y: yy, size, font, color });

  /** Va a capo entro la larghezza; restituisce le righe */
  const righe = (t: string, size: number, larghezza: number, font: PDFFont = f) => {
    const out: string[] = [];
    for (const par of pulisci(t).split("\n")) {
      let riga = "";
      for (const parola of par.split(/\s+/)) {
        const prova = riga ? `${riga} ${parola}` : parola;
        if (font.widthOfTextAtSize(prova, size) > larghezza && riga) {
          out.push(riga);
          riga = parola;
        } else riga = prova;
      }
      out.push(riga);
    }
    return out;
  };

  const piePagina = () => {
    page.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.6, color: LINE });
    const contatti = [d.agente?.nome, d.agente?.telefono, d.agenzia?.telefono, d.agenzia?.email].filter(Boolean).join("  ·  ");
    testo(contatti, M, 32, 8.5, f, GREY);
    const nota = `Report del ${data(r.creato)}`;
    testo(nota, W - M - f.widthOfTextAtSize(pulisci(nota), 8.5), 32, 8.5, f, GREY);
  };

  const nuovaPagina = () => {
    piePagina();
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const spazio = (h: number) => {
    if (y - h < 70) nuovaPagina();
  };

  // ---------- Testata ----------
  page.drawRectangle({ x: 0, y: H - 96, width: W, height: 96, color: NAVY });
  page.drawRectangle({ x: 0, y: H - 100, width: W, height: 4, color: BRICK });
  let xNome = M;
  if (img.logo) {
    try {
      const logo: PDFImage = img.logo.tipo === "png" ? await doc.embedPng(img.logo.bytes) : await doc.embedJpg(img.logo.bytes);
      const s = logo.scaleToFit(110, 50);
      page.drawRectangle({ x: M - 4, y: H - 48 - s.height / 2 - 4, width: s.width + 8, height: s.height + 8, color: rgb(1, 1, 1) });
      page.drawImage(logo, { x: M, y: H - 48 - s.height / 2, width: s.width, height: s.height });
      xNome = M + s.width + 18;
    } catch {
      // logo non leggibile: solo il nome
    }
  }
  testo(d.agenzia?.nome ?? "", xNome, H - 46, 18, b, rgb(1, 1, 1));
  testo("Report per il proprietario", xNome, H - 66, 11, f, rgb(0.85, 0.87, 0.9));
  const periodo = `Dal ${dataBreve(d.periodo.dal)} al ${dataBreve(d.periodo.al)}`;
  testo(periodo, W - M - f.widthOfTextAtSize(pulisci(periodo), 11), H - 46, 11, b, rgb(1, 1, 1));
  y = H - 136;

  // ---------- Immobile ----------
  const im = d.immobile ?? {};
  if (d.proprietario?.nome) {
    testo(`Gentile ${d.proprietario.nome}, ecco come sta andando il suo immobile.`, M, y, 11, f, GREY);
    y -= 26;
  }
  for (const r1 of righe(im.titolo || im.indirizzo || "", 20, W - 2 * M, b)) {
    testo(r1, M, y, 20, b);
    y -= 24;
  }
  testo([im.indirizzo, im.zona, im.citta].filter(Boolean).join(", "), M, y, 11.5, f, GREY);
  y -= 18;
  const dettagli = [
    im.prezzo ? `${euro(Number(im.prezzo))}${im.contratto === "affitto" ? " al mese" : ""}` : null,
    im.contratto === "affitto" ? "in affitto" : "in vendita",
    im.mq ? `${im.mq} mq` : null,
    im.locali ? `${im.locali} locali` : null,
  ].filter(Boolean).join("  ·  ");
  testo(dettagli, M, y, 11.5, b, BRICK);
  y -= 22;

  if (img.foto) {
    try {
      const foto = await doc.embedJpg(img.foto);
      const s = foto.scaleToFit(W - 2 * M, 180);
      page.drawImage(foto, { x: M + (W - 2 * M - s.width) / 2, y: y - s.height, width: s.width, height: s.height });
      y -= s.height + 22;
    } catch {
      // foto non leggibile: si prosegue senza
    }
  }

  // ---------- I numeri ----------
  const riquadri = (voci: [string, string, string][]) => {
    const gap = 10;
    const larg = (W - 2 * M - gap * (voci.length - 1)) / voci.length;
    spazio(78);
    voci.forEach(([valore, etichetta, nota], i) => {
      const x = M + i * (larg + gap);
      page.drawRectangle({ x, y: y - 70, width: larg, height: 70, color: IVORY });
      testo(valore, x + 12, y - 32, 22, b);
      for (const [k, r1] of righe(etichetta, 9, larg - 20).slice(0, 2).entries()) testo(r1, x + 12, y - 46 - k * 11, 9, f, GREY);
      if (nota) testo(nota, x + 12, y - 66 + (righe(etichetta, 9, larg - 20).length > 1 ? -2 : 9), 8, b, BRICK);
    });
    y -= 84;
  };
  riquadri([
    [String(d.visite_periodo ?? 0), "visite nel periodo", d.visite_totali ? `${d.visite_totali} in tutto` : ""],
    [String(d.richieste_compatibili ?? 0), "acquirenti compatibili", d.richieste_nuove ? `+${d.richieste_nuove} nuovi` : ""],
    [String(d.lead ?? 0), "richieste ricevute", d.proposto_a ? `proposto a ${d.proposto_a}` : ""],
    [String(d.giorni_sul_mercato ?? 0), "giorni sul mercato", d.visite_in_programma ? `${d.visite_in_programma} visite in arrivo` : ""],
  ]);
  const p = r.portali ?? {};
  if (p.visualizzazioni || p.contatti || p.preferiti) {
    riquadri([
      [p.visualizzazioni ? migliaia(Number(p.visualizzazioni)) : "—", "visualizzazioni sui portali", ""],
      [p.contatti ? String(p.contatti) : "—", "contatti dai portali", ""],
      [p.preferiti ? String(p.preferiti) : "—", "salvato tra i preferiti", ""],
    ]);
  }

  const titolo = (t: string) => {
    spazio(46);
    y -= 8;
    page.drawRectangle({ x: M, y: y - 3, width: 4, height: 16, color: BRICK });
    testo(t, M + 12, y, 14, b);
    y -= 24;
  };
  const paragrafo = (t: string, size = 10.5, font: PDFFont = f, color = NAVY, rientro = 0) => {
    for (const r1 of righe(t, size, W - 2 * M - rientro, font)) {
      spazio(16);
      testo(r1, M + rientro, y, size, font, color);
      y -= size + 4.5;
    }
  };
  const elenco = (voci: string[], colore = NAVY) => {
    for (const v of voci) {
      spazio(16);
      page.drawCircle({ x: M + 4, y: y + 3.5, size: 2.2, color: colore });
      const rr = righe(v, 10.5, W - 2 * M - 14);
      for (const [k, r1] of rr.entries()) {
        if (k) spazio(16);
        testo(r1, M + 14, y, 10.5);
        y -= 15;
      }
    }
  };

  // ---------- Cosa dicono i visitatori ----------
  titolo("Cosa dicono i visitatori");
  const gp = d.giudizio_prezzo ?? {};
  const totPrezzo = Number(gp.basso ?? 0) + Number(gp.giusto ?? 0) + Number(gp.alto ?? 0);
  const piaciuto: string[] = d.piaciuto ?? [];
  const nonPiaciuto: string[] = d.non_piaciuto ?? [];
  if (!totPrezzo && !piaciuto.length && !nonPiaciuto.length && !d.voto_medio) {
    paragrafo("Non ci sono ancora impressioni registrate: le raccogliamo dopo ogni visita e le troverà nel prossimo report.", 10.5, f, GREY);
  } else {
    if (d.voto_medio) paragrafo(`Voto medio dei visitatori: ${String(d.voto_medio).replace(".", ",")} su 5`, 11, b);
    if (totPrezzo) {
      spazio(40);
      y -= 4;
      paragrafo("Come giudicano il prezzo:", 10.5, b);
      const larg = W - 2 * M;
      let x = M;
      for (const [k, colore] of [["basso", GREEN], ["giusto", NAVY], ["alto", AMBER]] as const) {
        const n = Number(gp[k] ?? 0);
        if (!n) continue;
        const w = (n / totPrezzo) * larg;
        page.drawRectangle({ x, y: y - 6, width: w, height: 16, color: colore });
        const etichetta = `${n} ${k}`;
        if (f.widthOfTextAtSize(etichetta, 9) < w - 8) testo(etichetta, x + 6, y - 1.5, 9, b, rgb(1, 1, 1));
        x += w;
      }
      y -= 22;
      paragrafo(`${gp.basso ?? 0} lo trovano basso, ${gp.giusto ?? 0} giusto, ${gp.alto ?? 0} alto.`, 10, f, GREY);
    }
    if (piaciuto.length) {
      y -= 4;
      paragrafo("Cosa è piaciuto", 10.5, b, GREEN);
      elenco(piaciuto, GREEN);
    }
    if (nonPiaciuto.length) {
      y -= 4;
      paragrafo("Cosa si può migliorare", 10.5, b, AMBER);
      elenco(nonPiaciuto, AMBER);
    }
  }
  const offerte: number[] = (d.offerte ?? []).map(Number).filter((n: number) => n > 0);
  if (offerte.length || d.trattative) {
    y -= 4;
    if (offerte.length) paragrafo(`Offerte indicate dai visitatori: ${offerte.slice(0, 5).map(euro).join(", ")}`, 10.5, b);
    if (d.trattative) paragrafo(`Proposte in corso: ${d.trattative}${d.miglior_proposta ? `, la migliore è di ${euro(Number(d.miglior_proposta))}` : ""}.`, 10.5, b, BRICK);
  }

  // ---------- Le visite del periodo ----------
  const visite: Dati[] = d.visite ?? [];
  if (visite.length) {
    titolo("Le visite del periodo");
    spazio(24);
    const col = [M, M + 110, M + 190, M + 300];
    testo("Data", col[0], y, 9, b, GREY);
    testo("Voto", col[1], y, 9, b, GREY);
    testo("Prezzo", col[2], y, 9, b, GREY);
    testo("Come vuole procedere", col[3], y, 9, b, GREY);
    y -= 8;
    for (const v of visite.slice(0, 25)) {
      spazio(22);
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE });
      y -= 14;
      testo(data(v.data), col[0], y, 10);
      testo(v.voto ? `${v.voto} su 5` : "—", col[1], y, 10);
      testo(v.prezzo ? prezzi[v.prezzo] ?? v.prezzo : "—", col[2], y, 10);
      testo(v.intenzione ? intenzioni[v.intenzione] ?? v.intenzione : "In attesa di riscontro", col[3], y, 10, v.intenzione === "proposta" ? b : f);
      y -= 6;
    }
    if (visite.length > 25) paragrafo(`…e altre ${visite.length - 25} visite.`, 9.5, f, GREY);
    y -= 14;
  }

  // ---------- Il commento dell'agente ----------
  if (r.commento) {
    titolo(`Il commento di ${d.agente?.nome || "chi segue l'immobile"}`);
    const rr = righe(r.commento, 10.5, W - 2 * M - 28);
    const h = rr.length * 15 + 20;
    spazio(Math.min(h, 300));
    page.drawRectangle({ x: M, y: y - h + 14, width: W - 2 * M, height: h, color: IVORY });
    y -= 4;
    for (const r1 of rr) {
      spazio(16);
      testo(r1, M + 14, y, 10.5);
      y -= 15;
    }
    y -= 10;
  }

  // ---------- Chiusura ----------
  spazio(60);
  y -= 10;
  paragrafo("Per qualsiasi domanda può contattarci quando vuole.", 10.5, f, GREY);
  if (d.agente?.nome) paragrafo([d.agente.nome, d.agente.telefono].filter(Boolean).join(" · "), 11, b);
  piePagina();
  return await doc.save();
}
