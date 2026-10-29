import { useEffect, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Camera, GripVertical, Trash2 } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Section } from "@/components/shared/Section";
import { Spinner } from "@/components/shared/States";
import { VehiclePhoto } from "@/components/shared/VehiclePhoto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { useFotoUrls } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { VehiclePhoto as Foto, VehicleView } from "@/types/db";
import { MAX_FOTO, useCaricaFoto, useEliminaFoto, useFotoVeicolo, useRiordinaFoto } from "./api";

/**
 * Galleria foto: caricamento multiplo (anche trascinando i file), compressione automatica,
 * riordino trascinando le miniature (o con le frecce su telefono). La prima foto è la copertina.
 */
export function Galleria({ v, modificabile }: { v: VehicleView; modificabile: boolean }) {
  const { orgId } = useSessione();
  const foto = useFotoVeicolo(v.id);
  const lista = foto.data ?? [];
  const urls = useFotoUrls(lista.map((f) => f.storage_path));
  const carica = useCaricaFoto();
  const elimina = useEliminaFoto();
  const riordina = useRiordinaFoto();
  const [attiva, setAttiva] = useState(0);
  const [progresso, setProgresso] = useState<{ fatte: number; totali: number } | null>(null);
  const [trascinaFile, setTrascinaFile] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const sensori = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (attiva >= lista.length) setAttiva(0);
  }, [lista.length, attiva]);

  const posti = MAX_FOTO - lista.length;

  async function onFiles(files: File[]) {
    if (!files.length) return;
    let valide = files.filter((f) => f.type.startsWith("image/"));
    if (valide.length < files.length) toast.error("Alcuni file non sono immagini e sono stati saltati.");
    if (valide.length > posti) {
      toast.error(posti > 0 ? `Puoi aggiungere ancora ${posti} foto (massimo ${MAX_FOTO}).` : `Hai già ${MAX_FOTO} foto: eliminane qualcuna per aggiungerne altre.`);
      valide = valide.slice(0, Math.max(posti, 0));
    }
    if (!valide.length) return;
    try {
      await carica.mutateAsync({
        orgId,
        vehicleId: v.id,
        files: valide,
        ordineIniziale: lista.length,
        onProgresso: (fatte, totali) => setProgresso({ fatte, totali }),
      });
      toast.success(valide.length === 1 ? "Foto caricata" : `${valide.length} foto caricate`);
    } catch (e) {
      mostraErrore(e, "Caricamento delle foto non riuscito.");
    } finally {
      setProgresso(null);
      if (input.current) input.current.value = "";
    }
  }

  async function salvaOrdine(ordinate: Foto[], messaggio?: string) {
    try {
      await riordina.mutateAsync({ vehicleId: v.id, ordinate });
      if (messaggio) toast.success(messaggio);
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare il nuovo ordine.");
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const da = lista.findIndex((f) => f.id === active.id);
    const a = lista.findIndex((f) => f.id === over.id);
    void salvaOrdine(arrayMove(lista, da, a), a === 0 ? "Nuova copertina impostata" : undefined);
    setAttiva(a);
  }

  function sposta(i: number, verso: -1 | 1) {
    const j = i + verso;
    if (j < 0 || j >= lista.length) return;
    void salvaOrdine(arrayMove(lista, i, j), j === 0 ? "Nuova copertina impostata" : undefined);
    setAttiva(j);
  }

  async function onElimina(f: Foto) {
    if (!window.confirm("Eliminare questa foto?")) return;
    try {
      await elimina.mutateAsync(f);
      toast.success("Foto eliminata");
    } catch (e) {
      mostraErrore(e);
    }
  }

  const haFile = (e: DragEvent) => e.dataTransfer.types.includes("Files");
  const corrente = lista[attiva];
  const occupato = carica.isPending;

  return (
    <Section
      title="Foto"
      count={lista.length}
      bodyClassName="p-0 sm:p-0"
      action={
        modificabile && (
          <>
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="sr-only"
              id="carica-foto"
              onChange={(e) => void onFiles([...(e.target.files ?? [])])}
            />
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()} disabled={occupato || posti <= 0}>
              {occupato ? <Spinner className="size-4 animate-spin" /> : <Camera aria-hidden />}
              {occupato ? "Caricamento…" : "Aggiungi foto"}
            </Button>
          </>
        )
      }
    >
      <div
        onDragOver={(e) => {
          if (!modificabile || !haFile(e)) return;
          e.preventDefault();
          setTrascinaFile(true);
        }}
        onDragLeave={() => setTrascinaFile(false)}
        onDrop={(e) => {
          if (!modificabile || !haFile(e)) return;
          e.preventDefault();
          setTrascinaFile(false);
          void onFiles([...e.dataTransfer.files]);
        }}
        className={cn("relative", trascinaFile && "ring-4 ring-inset ring-accent/40")}
      >
        {trascinaFile && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-accent-soft/80 text-lg font-semibold text-accent">
            Rilascia qui le foto
          </div>
        )}

        {progresso && (
          <div className="border-b px-4 py-3" role="status">
            <div className="mb-1.5 flex justify-between text-sm">
              <span>Caricamento e compressione foto…</span>
              <span className="tabular-nums">
                {progresso.fatte}/{progresso.totali}
              </span>
            </div>
            <Progress value={(progresso.fatte / progresso.totali) * 100} />
          </div>
        )}

        {foto.isLoading ? (
          <div className="aspect-[4/3] animate-pulse bg-muted" />
        ) : lista.length === 0 ? (
          <div>
            <VehiclePhoto marca={v.marca} modello={v.modello} />
            {modificabile && (
              <div className="space-y-2 p-4 text-center">
                <Button variant="accent" className="w-full" onClick={() => input.current?.click()} disabled={occupato}>
                  <Camera aria-hidden /> Scatta o carica le foto
                </Button>
                <p className="hidden text-sm text-muted-foreground sm:block">Oppure trascina qui i file dal computer (fino a {MAX_FOTO} foto).</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="relative">
              <VehiclePhoto url={corrente ? urls.data?.[corrente.storage_path] : undefined} marca={v.marca} modello={v.modello} />
              {attiva === 0 && (
                <Badge tone="accent" size="sm" className="absolute left-3 top-3 bg-white/95 shadow-card">
                  Copertina
                </Badge>
              )}
              <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-sm font-medium text-white tabular-nums">
                {attiva + 1}/{lista.length}
              </span>
            </div>

            <div className="p-3">
              {modificabile && (
                <p className="mb-2 flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>Trascina le miniature per cambiare l'ordine: la prima è la copertina.</span>
                  <span className="shrink-0 tabular-nums">
                    {lista.length}/{MAX_FOTO}
                  </span>
                </p>
              )}
              <DndContext sensors={sensori} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={lista.map((f) => f.id)} strategy={rectSortingStrategy}>
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                    {lista.map((f, i) => (
                      <Miniatura
                        key={f.id}
                        foto={f}
                        indice={i}
                        totale={lista.length}
                        url={urls.data?.[f.storage_path]}
                        marca={v.marca}
                        attiva={i === attiva}
                        modificabile={modificabile}
                        onSeleziona={() => setAttiva(i)}
                        onSposta={(verso) => sposta(i, verso)}
                        onElimina={() => void onElimina(f)}
                        occupato={riordina.isPending || elimina.isPending}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function Miniatura({
  foto,
  indice,
  totale,
  url,
  marca,
  attiva,
  modificabile,
  onSeleziona,
  onSposta,
  onElimina,
  occupato,
}: {
  foto: Foto;
  indice: number;
  totale: number;
  url?: string | null;
  marca: string;
  attiva: boolean;
  modificabile: boolean;
  onSeleziona: () => void;
  onSposta: (verso: -1 | 1) => void;
  onElimina: () => void;
  occupato: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: foto.id, disabled: !modificabile });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative overflow-hidden rounded-md border-2 bg-card",
        attiva ? "border-accent" : "border-transparent",
        isDragging && "z-10 opacity-80 shadow-raised",
      )}
    >
      <button type="button" onClick={onSeleziona} className="block w-full" aria-label={`Foto ${indice + 1}${indice === 0 ? " (copertina)" : ""}`}>
        <VehiclePhoto url={url} marca={marca} />
      </button>
      {indice === 0 && (
        <span className="pointer-events-none absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-white">Copertina</span>
      )}
      {modificabile && (
        <>
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="absolute right-1 top-1 hidden size-7 cursor-grab items-center justify-center rounded bg-white/90 text-muted-foreground shadow-card active:cursor-grabbing sm:flex"
            aria-label={`Trascina per spostare la foto ${indice + 1}`}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
          <div className="flex items-center justify-between gap-1 bg-background/95 p-1">
            <button
              type="button"
              onClick={() => onSposta(-1)}
              disabled={indice === 0 || occupato}
              className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
              aria-label="Sposta a sinistra"
            >
              <ArrowLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onElimina}
              disabled={occupato}
              className="flex size-8 items-center justify-center rounded text-destructive hover:bg-destructive-soft disabled:opacity-30"
              aria-label="Elimina foto"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onSposta(1)}
              disabled={indice === totale - 1 || occupato}
              className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
              aria-label="Sposta a destra"
            >
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </>
      )}
    </li>
  );
}

