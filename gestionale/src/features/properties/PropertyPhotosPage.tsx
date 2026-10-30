import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Camera, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PropertyPhoto } from "@/components/shared/PropertyPhoto";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { addPropertyPhotos, getProperty } from "@/services/api";

/** Aggiunta delle foto a un immobile esistente (es. subito dopo l'incarico firmato). */
export function PropertyPhotosPage() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useQuery(() => getProperty(id), [id]);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-96" />;
  if (!data) return <EmptyState art="casa" title="Immobile non trovato" />;
  const p = data.property;
  const real = p.photos.filter((ph) => !ph.id.endsWith("_segnaposto") && (ph.url || ph.path));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { failed } = await addPropertyPhotos(p.id, [...files]);
      if (failed) toast.error(`${failed} foto non caricate`, { description: "Riprova con quelle mancanti." });
      else toast.success(files.length === 1 ? "Foto aggiunta" : `${files.length} foto aggiunte`);
    } catch (err) {
      toast.error("Foto non caricate", { description: friendlyError(err) });
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to={`/immobili/${p.id}`} label="Scheda immobile" />
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Aggiungi le foto</h1>
      <p className="mt-1 text-[17px] text-muted-foreground">
        {p.address}, {p.city}
      </p>

      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="mt-6 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft/40 px-6 py-10 text-center hover:bg-primary-soft disabled:opacity-60"
      >
        <Camera className="size-10 text-primary-strong" aria-hidden />
        <span className="text-[17px] font-semibold">{busy ? "Caricamento in corso…" : "Scatta o scegli le foto"}</span>
        <span className="text-[15px] text-muted-foreground">Puoi sceglierne più di una insieme. Le riduciamo noi per caricarle in fretta.</span>
      </button>

      {real.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold">Foto dell'immobile ({real.length})</h2>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {real.map((ph, i) => (
              <li key={ph.id} className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                <PropertyPhoto photo={ph} kind={p.kind} tint={p.tint} alt={`Foto ${i + 1}`} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Button size="lg" className="mt-8 w-full sm:w-auto" asChild>
        <Link to={`/immobili/${p.id}`}>
          <Check aria-hidden />
          Fatto, apri la scheda
        </Link>
      </Button>
    </div>
  );
}
