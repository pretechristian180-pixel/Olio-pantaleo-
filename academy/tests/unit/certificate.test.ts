import { describe, expect, it } from "vitest";
import { buildCertificatePdf, formatHours, pdfSafe } from "@/lib/certificate-pdf";

describe("attestato PDF", () => {
  it("testo compatibile con i font PDF", () => {
    expect(pdfSafe("Perché «sì» – l’ultimo…")).toBe("Perché \"sì\" - l'ultimo...");
    expect(pdfSafe("Corso 🚀 AI")).toBe("Corso  AI");
  });
  it("durata leggibile", () => {
    expect(formatHours(18360)).toBe("5 h 6 min");
    expect(formatHours(3600)).toBe("1 h");
    expect(formatHours(900)).toBe("15 min");
    expect(formatHours(0)).toBeNull();
  });
  it("genera un PDF valido anche con nomi lunghi e caratteri speciali", async () => {
    const bytes = await buildCertificatePdf(
      {
        codice: "NX-AAAA-BBBB-CCCC",
        nome_intestatario: "Maria Luisa D’Angelo De Santis Ferraresi Bonaccorsi",
        corso: "Un titolo di corso molto lungo con accenti: perché è così — e anche emoji 🎓",
        academy: "Studio Rossi",
        colore: "non-un-colore",
        docente: null,
        lezioni: 3,
        durata_sec: 0,
        rilasciato_il: "2026-11-05T10:00:00Z",
      },
      "https://studio-rossi.academy.nexoragruppodigitale.it/attestati/NX-AAAA-BBBB-CCCC",
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
