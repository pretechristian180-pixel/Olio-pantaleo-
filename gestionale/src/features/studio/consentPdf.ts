/**
 * PDF del consenso firmato: testo approvato (versione attiva), nome del firmatario,
 * data e ora, agenzia. Il file viene salvato in Storage (bucket privato "studio-consensi").
 */
export async function buildConsentPdf(input: {
  text: string;
  version: string;
  signer: string;
  agencyName: string;
  signedAt: Date;
}): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  const width = 210 - margin * 2;
  let y = 24;

  const write = (s: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(s, width) as string[]) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += size * 0.5;
    }
    y += 2;
  };

  write("Consenso all'uso dell'immagine e della voce per l'avatar AI", 15, true);
  write(`${input.agencyName} · Mattonio Studio · versione del testo ${input.version}`, 10);
  y += 4;
  write(input.text, 11);
  y += 6;
  write("Firma", 12, true);
  write(`Nome e cognome: ${input.signer}`);
  write(
    `Data e ora: ${input.signedAt.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Rome" })} (ora italiana)`,
  );
  write("Il firmatario ha dichiarato di aver letto e accettato il testo sopra riportato selezionando la casella di conferma.");
  return doc.output("blob");
}
