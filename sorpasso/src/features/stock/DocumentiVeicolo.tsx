import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Lock, Trash2, Upload } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { ErrorState, ListSkeleton, Spinner } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { dataBreve } from "@/lib/format";
import { TIPI_DOCUMENTO, TIPI_DOCUMENTO_VEICOLO } from "@/lib/labels";
import { apriDocumento } from "@/lib/storage";
import type { Document, TipoDocumento } from "@/types/db";
import { useCaricaDocumentoVeicolo, useDocumentiVeicolo, useEliminaDocumentoVeicolo } from "./api";

/**
 * Documenti del veicolo (libretto, certificato di proprietà, perizia): sezione privata,
 * visibile solo a titolare, responsabile vendite e amministrazione (RLS).
 */
export function DocumentiVeicolo({ vehicleId }: { vehicleId: string }) {
  const { orgId, isManager, isAmministrazione } = useSessione();
  const abilitato = isManager || isAmministrazione;
  const q = useDocumentiVeicolo(vehicleId, abilitato);
  const carica = useCaricaDocumentoVeicolo();
  const elimina = useEliminaDocumentoVeicolo();
  const [tipo, setTipo] = useState<TipoDocumento>("libretto");
  const input = useRef<HTMLInputElement>(null);
  if (!abilitato) return null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      await carica.mutateAsync({ orgId, vehicleId, tipo, file });
      toast.success(`${TIPI_DOCUMENTO[tipo]} caricato`);
    } catch (e) {
      mostraErrore(e, "Caricamento non riuscito.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function onApri(d: Document) {
    try {
      await apriDocumento(d.storage_path);
    } catch (e) {
      mostraErrore(e, "Non riesco ad aprire il documento.");
    }
  }

  async function onElimina(d: Document) {
    if (!window.confirm(`Eliminare «${d.nome_file}»?`)) return;
    try {
      await elimina.mutateAsync(d);
      toast.success("Documento eliminato");
    } catch (e) {
      mostraErrore(e);
    }
  }

  const lista = q.data ?? [];
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" aria-hidden /> Documenti del veicolo
        </span>
      }
      count={q.isLoading ? undefined : lista.length}
    >
      <p className="mb-3 text-sm text-muted-foreground">Privati: li vedono solo titolare, responsabile vendite e amministrazione.</p>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="sm:w-60">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)} aria-label="Tipo di documento">
            {TIPI_DOCUMENTO_VEICOLO.map((t) => (
              <option key={t} value={t}>
                {TIPI_DOCUMENTO[t]}
              </option>
            ))}
          </Select>
        </div>
        <input ref={input} type="file" accept="application/pdf,image/*" className="sr-only" id="doc-veicolo" onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button variant="secondary" onClick={() => input.current?.click()} disabled={carica.isPending}>
          {carica.isPending ? <Spinner /> : <Upload aria-hidden />}
          Carica documento
        </Button>
      </div>
      {q.isLoading ? (
        <ListSkeleton rows={2} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : lista.length === 0 ? (
        <p className="text-muted-foreground">Nessun documento. Carica libretto e certificato di proprietà appena l'auto entra in stock.</p>
      ) : (
        <ul className="divide-y">
          {lista.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-2.5">
              <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <button type="button" onClick={() => void onApri(d)} className="min-w-0 flex-1 text-left hover:text-accent">
                <span className="block truncate font-medium">{TIPI_DOCUMENTO[d.tipo]}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {d.nome_file} · {dataBreve(d.created_at)}
                </span>
              </button>
              <Button size="icon-sm" variant="ghost" className="text-destructive" onClick={() => void onElimina(d)} disabled={elimina.isPending} aria-label={`Elimina ${d.nome_file}`}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
