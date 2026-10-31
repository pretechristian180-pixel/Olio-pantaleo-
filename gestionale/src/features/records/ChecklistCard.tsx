import { useRef, useState } from "react";
import { Check, Paperclip, Plus, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addChecklistItem, getChecklist, linkChecklistDocument, setChecklistState, uploadDocument } from "@/services/records";
import type { ChecklistItem, ChecklistKind } from "@/types/records";
import { guessCategory } from "./labels";

/**
 * Checklist con le voci standard già pronte: documenti dell'immobile o antiriciclaggio della trattativa.
 * Ogni voce fatta registra chi l'ha completata e quando.
 */
export function ChecklistCard({
  recordRef,
  kind,
  canEdit = true,
}: {
  recordRef: { propertyId?: string; dealId?: string };
  kind: ChecklistKind;
  canEdit?: boolean;
}) {
  const { data, loading, error, reload } = useQuery(() => getChecklist(recordRef, kind), [recordRef.propertyId, recordRef.dealId, kind]);
  const [adding, setAdding] = useState("");

  const items = data ?? [];
  const relevant = items.filter((i) => i.state !== "non_serve");
  const done = relevant.filter((i) => i.state === "fatto").length;
  const missingRequired = items.filter((i) => i.required && i.state === "da_fare").length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (adding.trim().length < 2) return;
    try {
      await addChecklistItem(recordRef, kind, adding);
      setAdding("");
    } catch (err) {
      toast.error("Voce non aggiunta", { description: friendlyError(err) });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{kind === "documenti" ? "Documenti necessari" : "Antiriciclaggio"}</CardTitle>
        {data && (
          <span className={cn("text-[15px]", missingRequired ? "font-semibold text-warning" : "text-success")}>
            {missingRequired ? `${missingRequired} obbligatori mancanti` : "Tutto a posto"}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="mb-4">
              <Progress value={relevant.length ? (done / relevant.length) * 100 : 0} />
              <p className="mt-1.5 text-sm text-muted-foreground">
                {done} di {relevant.length} fatti
              </p>
            </div>
            {kind === "antiriciclaggio" && (
              <p className="mb-4 rounded-lg bg-muted px-4 py-3 text-[15px] text-foreground/80">
                Promemoria degli adempimenti per l'adeguata verifica del cliente. Non sostituisce la consulenza del vostro
                professionista: segnate nella nota cosa avete verificato.
              </p>
            )}
            <ul className="divide-y">
              {items.map((i) => (
                <Row key={i.id} item={i} kind={kind} recordRef={recordRef} canEdit={canEdit} />
              ))}
            </ul>
            {canEdit && (
              <form onSubmit={add} className="mt-4 flex gap-2">
                <Input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Aggiungi una voce" aria-label="Nuova voce" />
                <Button type="submit" variant="outline" disabled={adding.trim().length < 2}>
                  <Plus aria-hidden />
                  Aggiungi
                </Button>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  item: i,
  kind,
  recordRef,
  canEdit,
}: {
  item: ChecklistItem;
  kind: ChecklistKind;
  recordRef: { propertyId?: string; dealId?: string };
  canEdit: boolean;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(i.note ?? "");
  const done = i.state === "fatto";
  const skipped = i.state === "non_serve";

  async function set(state: ChecklistItem["state"], n?: string) {
    try {
      await setChecklistState(i.id, state, n);
    } catch (err) {
      toast.error("Non salvato", { description: friendlyError(err) });
    }
  }

  async function attach(f?: File) {
    if (!f) return;
    setBusy(true);
    try {
      const doc = await uploadDocument(recordRef, f, { category: guessCategory(i.label), name: i.label, expiresOn: null });
      await linkChecklistDocument(i.id, doc.id);
      toast.success("Documento caricato e voce completata");
    } catch (err) {
      toast.error("Documento non caricato", { description: friendlyError(err) });
    }
    setBusy(false);
  }

  return (
    <li className={cn("py-3 first:pt-0 last:pb-0", skipped && "opacity-60")}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={i.label}
          disabled={!canEdit || skipped}
          onClick={() => set(done ? "da_fare" : "fatto")}
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border-2",
            done ? "border-success bg-success text-white" : "border-border bg-card",
          )}
        >
          {done && <Check className="size-5" aria-hidden />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium", done && "text-muted-foreground line-through", skipped && "line-through")}>
            {i.label}{" "}
            {i.required && !done && !skipped && (
              <Badge tone="orange" dot={false} className="ml-1 px-2 py-0.5 text-[12px]">
                Obbligatorio
              </Badge>
            )}
          </p>
          {i.help && <p className="text-sm text-muted-foreground">{i.help}</p>}
          {(done || skipped) && i.doneAt && (
            <p className="text-sm text-muted-foreground">
              {skipped ? "Segnato come non necessario" : "Fatto"}
              {i.doneBy ? ` da ${i.doneBy}` : ""} il {formatShortDate(i.doneAt)}
            </p>
          )}
          {i.note && !noteOpen && <p className="mt-1 text-[15px] italic text-foreground/80">“{i.note}”</p>}
          {noteOpen && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                set(i.state, note);
                setNoteOpen(false);
              }}
            >
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cosa è stato verificato" autoFocus aria-label="Nota" />
              <Button type="submit" variant="outline">
                Salva
              </Button>
            </form>
          )}
          {canEdit && (
            <div className="mt-1 flex flex-wrap gap-1">
              {kind === "documenti" && !done && !skipped && (
                <>
                  <input ref={file} type="file" className="hidden" accept=".pdf,image/*,.doc,.docx" onChange={(e) => attach(e.target.files?.[0])} />
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => file.current?.click()}>
                    <Paperclip aria-hidden />
                    {busy ? "Carico…" : "Carica il file"}
                  </Button>
                </>
              )}
              {kind === "antiriciclaggio" && (
                <Button variant="ghost" size="sm" onClick={() => setNoteOpen((o) => !o)}>
                  <StickyNote aria-hidden />
                  Nota
                </Button>
              )}
              {!done && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => set(skipped ? "da_fare" : "non_serve")}>
                  {skipped ? "Serve di nuovo" : "Non serve"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
