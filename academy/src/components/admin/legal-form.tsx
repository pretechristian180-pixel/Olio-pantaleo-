"use client";

import { useActionState } from "react";
import { updateLegal, type LegalState } from "@/app/admin/actions";
import type { LegalData } from "@/lib/legal";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const CAMPI: { name: keyof LegalData; label: string; placeholder: string; type?: string }[] = [
  { name: "ragione_sociale", label: "Ragione sociale", placeholder: "Studio Rossi Srl" },
  { name: "piva", label: "Partita IVA", placeholder: "01234567890" },
  { name: "codice_fiscale", label: "Codice fiscale (se diverso)", placeholder: "" },
  { name: "sede", label: "Sede legale", placeholder: "Via Roma 1, 20121 Milano (MI)" },
  {
    name: "email",
    label: "Email per clienti e privacy",
    placeholder: "info@azienda.it",
    type: "email",
  },
  { name: "pec", label: "PEC", placeholder: "azienda@pec.it", type: "email" },
  { name: "foro", label: "Foro competente", placeholder: "Milano" },
];

export function LegalForm({ initial }: { initial: LegalData }) {
  const [state, action, pending] = useActionState<LegalState, FormData>(updateLegal, null);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPI.map((c) => (
          <div key={c.name} className={c.name === "sede" ? "sm:col-span-2" : undefined}>
            <Label htmlFor={`legal-${c.name}`}>{c.label}</Label>
            <Input
              id={`legal-${c.name}`}
              name={c.name}
              type={c.type ?? "text"}
              defaultValue={initial[c.name]}
              placeholder={c.placeholder}
            />
          </div>
        ))}
      </div>
      {state && (
        <Alert tone={state.ok ? "success" : "error"}>
          {state.ok ? "Dati salvati: le pagine legali sono aggiornate." : state.error}
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvo…" : "Salva i dati legali"}
      </Button>
    </form>
  );
}
