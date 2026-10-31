import { useState } from "react";
import { ChevronDown, Map, Navigation, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { FeaturePicker } from "@/features/records/FeaturePicker";
import { friendlyError } from "@/lib/errors";
import { statusLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { updateProperty } from "@/services/api";
import type { Property, PropertyStatus } from "@/types/domain";

const toNum = (s: string) => (s.replace(/[^\d]/g, "") ? Number(s.replace(/[^\d]/g, "")) : null);
const num = (v: number | null | undefined) => (v == null ? "" : String(v));

/** Link a Google Maps: posizione e indicazioni stradali (nessuna chiave API necessaria) */
export function MapLinks({ property: p, className }: { property: Property; className?: string }) {
  const q = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : `${p.address}, ${p.city}`;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button variant="outline" size="sm" asChild>
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`} target="_blank" rel="noopener noreferrer">
          <Map aria-hidden />
          Vedi sulla mappa
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`} target="_blank" rel="noopener noreferrer">
          <Navigation aria-hidden />
          Portami lì
        </a>
      </Button>
    </div>
  );
}

export function EditPropertyButton({ property, className }: { property: Property; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="lg" variant="outline" className={className} onClick={() => setOpen(true)}>
        <Pencil aria-hidden />
        Modifica
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Modifica immobile" description={property.address}>
          {open && <EditPropertyForm property={property} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditPropertyForm({ property: p, onDone }: { property: Property; onDone: () => void }) {
  const [f, setF] = useState({
    price: num(p.price),
    status: p.status,
    sqm: num(p.sqm),
    rooms: num(p.rooms),
    bathrooms: num(p.bathrooms),
    description: p.description,
    features: p.features ?? [],
    floor: p.floor ?? "",
    energyClass: p.energyClass ?? "",
    mandateEnd: p.mandateEnd ?? "",
  });
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const price = toNum(f.price);
    if (!price) return toast.error("Scrivi il prezzo");
    setBusy(true);
    try {
      await updateProperty(p.id, {
        price,
        status: f.status,
        sqm: toNum(f.sqm),
        rooms: toNum(f.rooms),
        bathrooms: toNum(f.bathrooms),
        description: f.description,
        features: f.features,
        floor: f.floor,
        energyClass: f.energyClass,
        mandateEnd: f.mandateEnd || null,
      });
      toast.success("Immobile aggiornato", { description: price !== p.price ? "Il matching ricalcola gli acquirenti compatibili." : undefined });
      onDone();
    } catch (err) {
      toast.error("Non salvato", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label={p.contract === "affitto" ? "Canone (€/mese)" : "Prezzo (€)"} htmlFor="ep-price">
          <Input id="ep-price" inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value)} />
        </Field>
        <Field label="Stato" htmlFor="ep-status">
          <Select id="ep-status" value={f.status} onChange={(e) => set("status", e.target.value as PropertyStatus)}>
            {(Object.keys(statusLabel) as PropertyStatus[]).map((s) => (
              <option key={s} value={s}>
                {statusLabel[s].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Mq" htmlFor="ep-sqm">
          <Input id="ep-sqm" inputMode="numeric" value={f.sqm} onChange={(e) => set("sqm", e.target.value)} />
        </Field>
        <Field label="Locali" htmlFor="ep-rooms">
          <Input id="ep-rooms" inputMode="numeric" value={f.rooms} onChange={(e) => set("rooms", e.target.value)} />
        </Field>
        <Field label="Bagni" htmlFor="ep-bath">
          <Input id="ep-bath" inputMode="numeric" value={f.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} />
        </Field>
      </div>
      <FeaturePicker label="Caratteristiche" value={f.features} onChange={(v) => set("features", v)} />
      <button type="button" onClick={() => setMore((m) => !m)} className="flex h-11 items-center gap-1.5 font-semibold text-primary-strong" aria-expanded={more}>
        <ChevronDown className={cn("size-5 transition-transform", more && "rotate-180")} aria-hidden />
        Altri dettagli
      </button>
      {more && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Piano" htmlFor="ep-floor">
              <Input id="ep-floor" value={f.floor} onChange={(e) => set("floor", e.target.value)} />
            </Field>
            <Field label="Classe energetica" htmlFor="ep-ape">
              <Input id="ep-ape" value={f.energyClass} onChange={(e) => set("energyClass", e.target.value.toUpperCase())} maxLength={4} />
            </Field>
          </div>
          <Field label="Incarico fino al" htmlFor="ep-mand">
            <Input id="ep-mand" type="date" value={f.mandateEnd} onChange={(e) => set("mandateEnd", e.target.value)} />
          </Field>
          <Field label="Descrizione" htmlFor="ep-desc">
            <Textarea id="ep-desc" value={f.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Salvataggio…" : "Salva"}
      </Button>
    </form>
  );
}
