/** Versione "anteprima" di src/services/reports.ts: storico finto e un PDF di esempio creato nel browser. */
import { emitChange } from "@/services/events";
import type { OwnerReport, PortalNumbers, PreparedReport } from "@/types/reports";

const wait = <T,>(value: T, ms = 400) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const byProperty = new Map<string, OwnerReport[]>();
const seed = (propertyId: string): OwnerReport[] => [
  { id: `${propertyId}_r1`, createdAt: ago(15), from: ago(30), to: ago(15), state: "inviato", sentVia: "automatico", sentAt: ago(15), openedAt: ago(14), opens: 2, origin: "automatico", visits: 3, matches: 9 },
  { id: `${propertyId}_r0`, createdAt: ago(30), from: ago(45), to: ago(30), state: "inviato", sentVia: "whatsapp", sentAt: ago(30), openedAt: null, opens: 0, origin: "manuale", visits: 1, matches: 6 },
];
const list = (id: string) => {
  if (!byProperty.has(id)) byProperty.set(id, seed(id));
  return byProperty.get(id)!;
};

async function pdfDiEsempio(comment: string, portals: PortalNumbers) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFillColor(22, 32, 46);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Immobiliare Levante", 14, 16);
  doc.setFontSize(11);
  doc.text("Report per il proprietario (esempio)", 14, 25);
  doc.setTextColor(22, 32, 46);
  doc.setFontSize(16);
  doc.text("Trilocale luminoso con balcone, Via Roma 48", 14, 48);
  doc.setFontSize(12);
  const righe = [
    "Visite nel periodo: 4 (9 in tutto)",
    "Acquirenti compatibili: 14 (+3 nuovi)",
    "Giorni sul mercato: 46",
    portals.visualizzazioni ? `Visualizzazioni sui portali: ${portals.visualizzazioni}` : "",
    "Prezzo: 1 lo trova basso, 3 giusto, 3 alto",
    "Cosa è piaciuto: molto luminoso, balcone grande",
    "Da migliorare: bagno da rifare",
    comment ? `Commento: ${comment}` : "",
  ].filter(Boolean);
  righe.forEach((r, i) => doc.text(doc.splitTextToSize(r, 180), 14, 64 + i * 10));
  doc.setFontSize(9);
  doc.text("Nell'app vera il PDF è impaginato completo, con foto, grafico dei prezzi e visite del periodo.", 14, 150);
  return URL.createObjectURL(doc.output("blob"));
}

export async function listReports(propertyId: string) {
  return wait(list(propertyId).map((r) => ({ ...r })), 200);
}
export async function prepareReport(propertyId: string, comment: string, portals: PortalNumbers): Promise<PreparedReport> {
  const r: OwnerReport = { id: `${propertyId}_${Date.now()}`, createdAt: new Date().toISOString(), from: ago(15), to: new Date().toISOString(), state: "pronto", sentVia: null, sentAt: null, openedAt: null, opens: 0, origin: "manuale", visits: 4, matches: 14 };
  list(propertyId).unshift(r);
  const pdf = await pdfDiEsempio(comment, portals);
  emitChange();
  return wait({ id: r.id, link: "https://app.mattonio.it/report/esempio", pdf }, 900);
}
export async function reportLinks(_id: string) {
  return { pdf: await pdfDiEsempio("", {}), link: "https://app.mattonio.it/report/esempio" };
}
export async function emailReport(id: string) {
  await markReportSent(id, "email");
  return wait("nicola.ricci@email.it");
}
export async function markReportSent(id: string, channel: "whatsapp" | "email") {
  for (const l of byProperty.values()) {
    const r = l.find((x) => x.id === id);
    if (r) Object.assign(r, { state: "inviato", sentVia: channel, sentAt: new Date().toISOString() });
  }
  emitChange();
}
export async function openPublicReport(_t: string) {
  return wait({ url: await pdfDiEsempio("", {}), agenzia: "Immobiliare Levante", indirizzo: "Via Roma 48", dal: ago(15), al: new Date().toISOString() });
}
