import { describe, expect, it } from "vitest";
import {
  academyWelcome,
  escapeHtml,
  purchaseConfirmation,
  saleNotification,
} from "@/lib/email-templates";

const brand = { nome: "Studio Rossi", colore: "#0a7f5a" };

describe("email", () => {
  it("escape dell'HTML", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe(
      "&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;",
    );
  });

  it("conferma acquisto: testi, link e niente HTML iniettato", () => {
    const e = purchaseConfirmation({
      brand,
      nome: "Anna",
      corso: "Corso <script>",
      importo: "197,00 €",
      url: "https://studio-rossi.academy.nexoragruppodigitale.it/app/corsi/x",
    });
    expect(e.subject).toContain("Corso <script>");
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("Corso &lt;script&gt;");
    expect(e.html).toContain("#0a7f5a");
    expect(e.text).toContain("/app/corsi/x");
    expect(e.text).toContain("Ciao Anna,");
  });

  it("colore del marchio non valido: si usa il blu Nexora", () => {
    const e = saleNotification({
      brand: { nome: "X", colore: "red;}" },
      corso: "C",
      importo: "10 €",
      studente: "Luca",
      url: "https://x.it/admin",
    });
    expect(e.html).toContain("#0042ed");
    expect(e.html).not.toContain("red;}");
  });

  it("benvenuto academy", () => {
    const e = academyWelcome({ nomeAcademy: "Studio Rossi", url: "https://s.it/admin" });
    expect(e.subject).toContain("Studio Rossi");
    expect(e.text).toContain("https://s.it/admin");
  });
});

describe("email risposta", () => {
  it("accorcia le risposte lunghe ed esegue l'escape", async () => {
    const { answerNotification } = await import("@/lib/email-templates");
    const e = answerNotification({
      brand,
      lezione: "Pipeline",
      risposta: "<b>" + "x".repeat(700),
      url: "https://s.it/app/corsi/c/l",
    });
    expect(e.html).not.toContain("<b>x");
    expect(e.text).toContain("…");
    expect(e.subject).toContain("Pipeline");
  });
});
