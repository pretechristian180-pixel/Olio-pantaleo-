import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Segmented } from "@/components/ui/segmented";
import { BackLink } from "@/components/shared/BackLink";
import { kindLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { createProperty, listZones } from "@/services/api";
import type { Contract, PropertyKind } from "@/types/domain";

const steps = ["Foto", "Dati", "Prezzo", "Proprietario"] as const;

interface FormState {
  photos: { id: string; url: string }[];
  kind: PropertyKind;
  contract: Contract;
  address: string;
  city: string;
  zone: string;
  sqm: string;
  rooms: string;
  bathrooms: string;
  description: string;
  price: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerPhone: string;
}

const initial: FormState = {
  photos: [],
  kind: "appartamento",
  contract: "vendita",
  address: "",
  city: "",
  zone: "",
  sqm: "",
  rooms: "",
  bathrooms: "1",
  description: "",
  price: "",
  ownerFirstName: "",
  ownerLastName: "",
  ownerPhone: "",
};

/** Inserimento immobile in 4 passaggi, con barra di avanzamento. */
export function NewPropertyPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function validate(s: number) {
    const e: typeof errors = {};
    if (s === 1) {
      if (!form.address.trim()) e.address = "Scrivi l'indirizzo";
      if (!form.city.trim()) e.city = "Scrivi la città";
      if (!Number(form.sqm)) e.sqm = "Quanti metri quadri?";
      if (!Number(form.rooms)) e.rooms = "Quanti locali?";
    }
    if (s === 2 && !Number(form.price)) e.price = "Scrivi il prezzo";
    if (s === 3) {
      if (!form.ownerFirstName.trim()) e.ownerFirstName = "Scrivi il nome";
      if (!form.ownerLastName.trim()) e.ownerLastName = "Scrivi il cognome";
      if (form.ownerPhone.replace(/\D/g, "").length < 6) e.ownerPhone = "Controlla il numero";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function next() {
    if (!validate(step)) return;
    if (step < steps.length - 1) {
      setStep(step + 1);
      window.scrollTo(0, 0);
      return;
    }
    setSaving(true);
    const p = await createProperty({
      kind: form.kind,
      contract: form.contract,
      status: "disponibile",
      title: `${kindLabel[form.kind]} ${form.city ? `a ${form.city}` : ""}`.trim(),
      address: form.address,
      city: form.city,
      zone: form.zone || form.city,
      sqm: Number(form.sqm),
      rooms: Number(form.rooms),
      bathrooms: Number(form.bathrooms) || 1,
      price: Number(form.price),
      description: form.description || "Descrizione da completare.",
      photos: form.photos.length
        ? form.photos.map((ph) => ({ id: ph.id, url: ph.url, scene: "esterno" as const }))
        : [{ id: "new", scene: "esterno" }],
      owner: { firstName: form.ownerFirstName, lastName: form.ownerLastName, phone: form.ownerPhone },
    });
    toast.success("Immobile salvato", { description: `${p.address}, ${p.city}` });
    navigate(`/immobili/${p.id}`, { replace: true });
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const added = [...files].map((f) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(f) }));
    set("photos", [...form.photos, ...added]);
  }

  const zones = listZones();
  const isLast = step === steps.length - 1;

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink to="/immobili" label="Annulla" />
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Nuovo immobile</h1>

      {/* Avanzamento */}
      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[17px] font-semibold">
            {step + 1}. {steps[step]}
          </p>
          <p className="text-muted-foreground">
            Passo {step + 1} di {steps.length}
          </p>
        </div>
        <Progress value={((step + 1) / steps.length) * 100} />
        <ol className="mt-3 hidden grid-cols-4 gap-2 sm:grid">
          {steps.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-2 text-[15px]", i <= step ? "text-foreground" : "text-muted-foreground")}>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-sm font-semibold",
                  i < step ? "bg-success text-white" : i === step ? "bg-primary text-white" : "bg-muted",
                )}
              >
                {i < step ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 space-y-5">
        {step === 0 && (
          <>
            <p className="text-[17px] text-muted-foreground">Aggiungi qualche foto. Puoi farle anche adesso con il telefono.</p>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-input bg-muted/50 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-primary-soft/40">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
                <ImagePlus className="size-7" aria-hidden />
              </span>
              <span className="text-[17px] font-semibold">Scegli o scatta le foto</span>
              <span className="text-muted-foreground">Puoi sceglierne più di una</span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
            </label>
            {form.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {form.photos.map((ph, i) => (
                  <div key={ph.id} className="relative aspect-square overflow-hidden rounded-lg">
                    <img src={ph.url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-sm text-white">Copertina</span>
                    )}
                    <button
                      type="button"
                      onClick={() => set("photos", form.photos.filter((x) => x.id !== ph.id))}
                      className="absolute inset-x-2 bottom-2 flex h-9 items-center justify-center gap-1 rounded-md bg-white/95 text-sm font-medium"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Togli
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <Segmented
              label="Contratto"
              value={form.contract}
              onChange={(v) => set("contract", v)}
              options={[
                { value: "vendita", label: "In vendita" },
                { value: "affitto", label: "In affitto" },
              ]}
            />
            <Field label="Che tipo di immobile è?" htmlFor="np-kind">
              <Select id="np-kind" value={form.kind} onChange={(e) => set("kind", e.target.value as PropertyKind)}>
                {(Object.keys(kindLabel) as PropertyKind[]).map((k) => (
                  <option key={k} value={k}>
                    {kindLabel[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <TextField id="np-address" label="Indirizzo" placeholder="Es. Via Sparano 15" value={form.address} error={errors.address} onChange={(v) => set("address", v)} />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField id="np-city" label="Città" placeholder="Es. Bari" value={form.city} error={errors.city} onChange={(v) => set("city", v)} />
              <Field label="Zona" htmlFor="np-zone">
                <Input id="np-zone" list="np-zones" value={form.zone} onChange={(e) => set("zone", e.target.value)} placeholder="Es. Bari – Murat" />
                <datalist id="np-zones">
                  {zones.map((z) => (
                    <option key={z} value={z} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <TextField id="np-sqm" label="Metri quadri" inputMode="numeric" value={form.sqm} error={errors.sqm} onChange={(v) => set("sqm", v.replace(/\D/g, ""))} />
              <TextField id="np-rooms" label="Locali" inputMode="numeric" value={form.rooms} error={errors.rooms} onChange={(v) => set("rooms", v.replace(/\D/g, ""))} />
              <TextField id="np-baths" label="Bagni" inputMode="numeric" value={form.bathrooms} onChange={(v) => set("bathrooms", v.replace(/\D/g, ""))} />
            </div>
            <Field label="Descrizione (facoltativa)" htmlFor="np-desc">
              <Textarea id="np-desc" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Cosa rende speciale questa casa?" />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field
              label={form.contract === "affitto" ? "Affitto al mese" : "Prezzo di vendita"}
              htmlFor="np-price"
              hint={
                Number(form.price) && Number(form.sqm)
                  ? `Circa ${formatPrice(Math.round(Number(form.price) / Number(form.sqm)))} al metro quadro`
                  : undefined
              }
            >
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">€</span>
                <Input
                  id="np-price"
                  inputMode="numeric"
                  value={form.price ? Number(form.price).toLocaleString("it-IT") : ""}
                  onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  aria-invalid={!!errors.price}
                  className={cn("h-16 pl-11 text-2xl font-semibold", errors.price && "border-destructive")}
                />
              </div>
              {errors.price && <p className="mt-1.5 text-sm font-medium text-destructive">{errors.price}</p>}
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-[17px] text-muted-foreground">Chi è il proprietario? Lo aggiungiamo anche ai tuoi contatti.</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField id="np-ofn" label="Nome" value={form.ownerFirstName} error={errors.ownerFirstName} onChange={(v) => set("ownerFirstName", v)} />
              <TextField id="np-oln" label="Cognome" value={form.ownerLastName} error={errors.ownerLastName} onChange={(v) => set("ownerLastName", v)} />
            </div>
            <TextField id="np-oph" label="Telefono" type="tel" inputMode="tel" placeholder="Es. 333 123 4567" value={form.ownerPhone} error={errors.ownerPhone} onChange={(v) => set("ownerPhone", v)} />
          </>
        )}
      </div>

      {/* Pulsanti: l'azione principale è sempre a destra e più grande */}
      <div className="mt-10 flex gap-3">
        {step > 0 && (
          <Button variant="outline" size="lg" onClick={back} className="px-4">
            <ArrowLeft aria-hidden />
            Indietro
          </Button>
        )}
        <Button size="lg" onClick={next} disabled={saving} className="flex-1">
          {isLast ? (
            <>
              <Check aria-hidden />
              {saving ? "Salvataggio…" : "Salva immobile"}
            </>
          ) : step === 0 && form.photos.length === 0 ? (
            <>
              Salta, le aggiungo dopo
              <ArrowRight aria-hidden />
            </>
          ) : (
            <>
              Avanti
              <ArrowRight aria-hidden />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
} & Omit<React.ComponentProps<"input">, "onChange" | "value">) {
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={cn(error && "border-destructive")}
        {...rest}
      />
      {error && <p className="mt-1.5 text-sm font-medium text-destructive">{error}</p>}
    </Field>
  );
}
