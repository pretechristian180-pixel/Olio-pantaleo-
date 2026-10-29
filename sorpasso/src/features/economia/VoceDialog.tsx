import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { euroCent, toDateInput } from "@/lib/format";
import { numeroIt } from "@/lib/schemas";
import type { CategoriaEconomica, VehicleCost, VehicleRevenue } from "@/types/db";
import { ALIQUOTE, CATEGORIA_VENDITA, useSalvaCosto, useSalvaRicavo } from "./api";

const schema = z.object({
  data: z.string().min(1, "Scegli la data"),
  categoria: z.string().min(1, "Scegli la categoria"),
  descrizione: z.string().trim().max(300, "Massimo 300 caratteri"),
  fornitore: z.string().trim().max(120, "Massimo 120 caratteri"),
  importo: z
    .string()
    .trim()
    .min(1, "Inserisci l'importo")
    .refine((v) => !Number.isNaN(numeroIt(v)) && numeroIt(v) >= 0, "Importo non valido")
    .refine((v) => numeroIt(v) < 10_000_000, "Importo troppo alto"),
  iva_aliquota: z.string(),
});
type Valori = z.infer<typeof schema>;

/**
 * Inserimento/modifica di una voce del conto economico.
 * Costi: importo = imponibile (netto IVA) + fattura facoltativa.
 * Ricavi: importo = quanto paga il cliente (IVA compresa, se dovuta).
 */
export function VoceDialog({
  open,
  onOpenChange,
  tipo,
  vehicleId,
  categorie,
  voce,
  venditaGiaPresente,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: "costo" | "ricavo";
  vehicleId: string;
  categorie: CategoriaEconomica[];
  voce?: VehicleCost | VehicleRevenue | null;
  /** Esiste già una voce "Prezzo di vendita": non se ne può aggiungere un'altra */
  venditaGiaPresente?: boolean;
}) {
  const { orgId } = useSessione();
  const salvaCosto = useSalvaCosto();
  const salvaRicavo = useSalvaRicavo();
  const file = useRef<HTMLInputElement>(null);
  const costo = tipo === "costo";

  const form = useForm<Valori>({ resolver: zodResolver(schema) });
  const err = form.formState.errors;

  useEffect(() => {
    if (!open) return;
    form.reset({
      data: voce?.data ?? toDateInput(new Date()),
      categoria: voce?.categoria ?? "",
      descrizione: voce?.descrizione ?? "",
      fornitore: voce && "fornitore" in voce ? (voce.fornitore ?? "") : "",
      importo: voce ? String(voce.importo).replace(".", ",") : "",
      iva_aliquota: String(voce?.iva_aliquota ?? 22),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, voce?.id]);

  const [importo, aliquota] = useWatch({ control: form.control, name: ["importo", "iva_aliquota"] });
  const n = numeroIt(importo ?? "");
  const a = Number(aliquota ?? 22);
  const anteprima = Number.isNaN(n)
    ? null
    : costo
      ? { iva: (n * a) / 100, totale: n + (n * a) / 100 }
      : { iva: (n * a) / (100 + a), totale: (n * 100) / (100 + a) };

  // Categorie attive del tipo giusto; quella della voce resta selezionabile anche se disattivata nel frattempo
  const opzioni = categorie.filter(
    (c) =>
      c.tipo === tipo &&
      (c.attiva || c.nome === voce?.categoria) &&
      !(tipo === "ricavo" && c.nome === CATEGORIA_VENDITA && venditaGiaPresente && voce?.categoria !== CATEGORIA_VENDITA),
  );
  if (voce && !opzioni.some((c) => c.nome === voce.categoria)) {
    opzioni.push({ id: "corrente", nome: voce.categoria, tipo, ordine: 999, di_sistema: false, attiva: false, organization_id: orgId });
  }

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      if (costo) {
        await salvaCosto.mutateAsync({
          id: voce?.id,
          orgId,
          vehicle_id: vehicleId,
          data: v.data,
          categoria: v.categoria,
          descrizione: v.descrizione || null,
          fornitore: v.fornitore || null,
          importo: numeroIt(v.importo),
          iva_aliquota: Number(v.iva_aliquota),
          file: file.current?.files?.[0] ?? null,
          allegatoPrecedente: voce && "allegato_path" in voce ? voce.allegato_path : null,
        });
      } else {
        await salvaRicavo.mutateAsync({
          id: voce?.id,
          vehicle_id: vehicleId,
          data: v.data,
          categoria: v.categoria,
          descrizione: v.descrizione || null,
          importo: numeroIt(v.importo),
          iva_aliquota: Number(v.iva_aliquota),
        });
      }
      toast.success(voce ? "Voce aggiornata" : costo ? "Costo aggiunto" : "Ricavo aggiunto");
      onOpenChange(false);
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare la voce.");
    }
  });

  const titolo = `${voce ? "Modifica" : "Nuovo"} ${costo ? "costo" : "ricavo"}`;
  const allegatoAttuale = voce && "allegato_path" in voce ? voce.allegato_path : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={titolo}
        description={costo ? "Inserisci l'imponibile (importo senza IVA) come da fattura." : "Inserisci quanto paga il cliente, IVA compresa se dovuta."}
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data" htmlFor="ve-data" required error={err.data?.message}>
              <Input id="ve-data" type="date" aria-invalid={!!err.data} {...form.register("data")} />
            </Field>
            <Field label="Categoria" htmlFor="ve-cat" required error={err.categoria?.message}>
              <Select id="ve-cat" aria-invalid={!!err.categoria} {...form.register("categoria")}>
                <option value="">Scegli…</option>
                {opzioni.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Descrizione" htmlFor="ve-desc" error={err.descrizione?.message}>
            <Textarea id="ve-desc" className="min-h-20" placeholder={costo ? "Es. sostituzione pastiglie e dischi" : "Es. garanzia estesa 24 mesi"} {...form.register("descrizione")} />
          </Field>
          {costo && (
            <Field label="Fornitore" htmlFor="ve-forn" error={err.fornitore?.message}>
              <Input id="ve-forn" placeholder="Es. Officina Rossi" {...form.register("fornitore")} />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={costo ? "Imponibile (€)" : "Importo IVA inclusa (€)"}
              htmlFor="ve-imp"
              required
              error={err.importo?.message}
            >
              <Input id="ve-imp" inputMode="decimal" placeholder="0,00" aria-invalid={!!err.importo} {...form.register("importo")} />
            </Field>
            <Field label="Aliquota IVA" htmlFor="ve-iva" hint={!costo && a === 0 ? "0% per operazioni esenti (es. provvigioni, assicurazioni)" : undefined}>
              <Select id="ve-iva" {...form.register("iva_aliquota")}>
                {ALIQUOTE.map((x) => (
                  <option key={x} value={x}>
                    {x === 0 ? "0% / esente" : `${x}%`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {anteprima && (
            <p className="rounded-lg bg-muted px-4 py-3 text-[15px]">
              {costo ? (
                <>
                  IVA {euroCent(anteprima.iva)} · Totale fattura <strong>{euroCent(anteprima.totale)}</strong>
                </>
              ) : (
                <>
                  di cui IVA {euroCent(anteprima.iva)} · Netto <strong>{euroCent(anteprima.totale)}</strong>
                </>
              )}
            </p>
          )}
          {costo && (
            <Field
              label="Fattura (PDF o foto)"
              htmlFor="ve-file"
              hint={allegatoAttuale ? "C'è già una fattura: caricandone un'altra la sostituisci." : "Facoltativa, max 15 MB."}
            >
              <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 text-[15px] text-muted-foreground hover:bg-muted">
                <Paperclip className="size-5" aria-hidden />
                <input id="ve-file" ref={file} type="file" accept="application/pdf,image/*" className="text-[15px]" />
              </label>
            </Field>
          )}
          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            {voce ? "Salva modifiche" : costo ? "Aggiungi costo" : "Aggiungi ricavo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
