import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookie policy" };

// Testo definitivo fornito da Nexora in Fase 7.
export default function Page() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Cookie policy</h1>
      <p className="text-muted-foreground">
        Il testo completo sarà pubblicato a breve. Per qualsiasi domanda scrivi a
        info@nexoragruppodigitale.it.
      </p>
    </>
  );
}
