import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Trash2, Upload } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { ListSkeleton, Spinner } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { dataBreve } from "@/lib/format";
import { TIPI_DOCUMENTO, opzioni } from "@/lib/labels";
import { apriDocumento } from "@/lib/storage";
import type { Document, TipoDocumento } from "@/types/db";
import { type RiferimentoDocumenti, useCaricaDocumento, useDocumenti, useEliminaDocumento } from "./api";

const dimensione = (b: number | null) =>
  b == null ? "" : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

/**
 * Elenco documenti di un cliente o di una pratica, con caricamento.
 * Su telefono "Carica" apre anche la fotocamera: si fotografa la patente in salone.
 */
export function DocumentiSezione({ rif, puoCaricare = true }: { rif: RiferimentoDocumenti; puoCaricare?: boolean }) {
  const { orgId, puo } = useSessione();
  const puoEliminare = puo("titolare", "responsabile_vendite", "amministrazione");
  const documenti = useDocumenti(rif);
  const carica = useCaricaDocumento(rif);
  const elimina = useEliminaDocumento();
  const [tipo, setTipo] = useState<TipoDocumento>("carta_identita");
  const input = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      await carica.mutateAsync({ file, tipo, orgId });
      toast.success("Documento caricato");
    } catch (e) {
      mostraErrore(e, "Caricamento non riuscito. Riprova.");
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
    if (!window.confirm(`Eliminare "${d.nome_file}"?`)) return;
    try {
      await elimina.mutateAsync(d);
      toast.success("Documento eliminato");
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <Section title="Documenti" count={documenti.data?.length}>
      {puoCaricare && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="sm:w-56">
            <Select aria-label="Tipo di documento" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
              {opzioni(TIPI_DOCUMENTO).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
            aria-label="Scegli il file"
          />
          <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={carica.isPending}>
            {carica.isPending ? <Spinner /> : <Upload aria-hidden />}
            Carica documento
          </Button>
        </div>
      )}

      {documenti.isLoading ? (
        <ListSkeleton rows={2} />
      ) : documenti.isError ? (
        <p className="text-[15px] text-destructive">Impossibile caricare i documenti.</p>
      ) : !documenti.data?.length ? (
        <p className="text-[15px] text-muted-foreground">Nessun documento. Carica carta d'identità, patente e codice fiscale.</p>
      ) : (
        <ul className="divide-y">
          {documenti.data.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-2.5">
              <button type="button" onClick={() => void onApri(d)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <FileText className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{TIPI_DOCUMENTO[d.tipo]}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {d.nome_file} · {dataBreve(d.created_at)} {dimensione(d.dimensione_byte) && `· ${dimensione(d.dimensione_byte)}`}
                  </span>
                </span>
              </button>
              {puoEliminare && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void onElimina(d)}
                  aria-label={`Elimina ${d.nome_file}`}
                  disabled={elimina.isPending}
                >
                  <Trash2 className="text-muted-foreground" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
