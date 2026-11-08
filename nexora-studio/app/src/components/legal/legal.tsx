/** Elementi comuni delle pagine legali: intestazione, sezioni, tabelle leggibili anche da telefono. */
export const LEGAL_UPDATED = "5 novembre 2026";
export const LEGAL_VERSION = "2026-11-05";

export function LegalHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="grid gap-2 border-b pb-6">
      <h1 className="text-3xl font-semibold">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      <p className="text-sm text-muted-foreground">Ultimo aggiornamento: {LEGAL_UPDATED}</p>
    </header>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-3 text-[0.9375rem] leading-relaxed text-muted-foreground [&_a]:text-primary-text [&_a]:underline [&_a]:underline-offset-4 [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export function LegalTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-muted/50 text-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t align-top">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={j === 0 ? "px-3 py-2 font-medium text-foreground" : "px-3 py-2"}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const COMPANY =
  "CPECOMGROUP di Prete Christian, impresa individuale che opera con il marchio Christian Prete Agency, con sede in Via San Nicola 20, 74023 Grottaglie (TA), P.IVA IT03436340735";
export const CONTACT_EMAIL = "studio@fasanomail.it";
export const CONTACT_PEC = "cpecomgroup@legalmail.it";

/** Clausole da approvare specificamente (artt. 1341 e 1342 c.c.), mostrate anche alla registrazione. */
export const VEXATIOUS_CLAUSES =
  "art. 4.3 (video e crediti non cumulabili), art. 5.2 (rinnovo automatico), art. 5.3 (modifica dei prezzi), art. 5.4 (sospensione per mancato pagamento), art. 6.1 e 6.3 (disdetta senza rimborso, sospensione e chiusura dell'account), art. 6.4 (cancellazione dei contenuti), art. 11 (esclusione di responsabilità per servizi di terzi), art. 13 (limitazione di responsabilità), art. 14 (manleva), art. 16 (modifiche ai Termini), art. 17 (foro esclusivo)";
