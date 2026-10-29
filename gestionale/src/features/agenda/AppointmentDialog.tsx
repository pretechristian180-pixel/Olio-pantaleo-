import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { appointmentKind, toneClasses } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { fullName, formatLongDate } from "@/lib/format";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { createAppointment, pickerOptions } from "@/services/api";
import type { AppointmentKind, ID } from "@/types/domain";

interface Defaults {
  start?: Date;
  contactId?: ID;
  propertyId?: ID;
  kind?: AppointmentKind;
}

const Ctx = createContext<{ openAppointment: (d?: Defaults) => void } | null>(null);

/** Permette di aprire "Nuovo appuntamento" da qualsiasi schermata (pulsante +, card contatto, agenda). */
export function AppointmentDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState<Defaults>({});
  const [key, setKey] = useState(0);

  const openAppointment = useCallback((d: Defaults = {}) => {
    setDefaults(d);
    setKey((k) => k + 1);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openAppointment }), [openAppointment]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Nuovo appuntamento" description={defaults.start ? formatLongDate(defaults.start) : undefined}>
          <AppointmentForm key={key} defaults={defaults} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function useAppointmentDialog() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppointmentDialog fuori dal provider");
  return ctx;
}

function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AppointmentForm({ defaults, onDone }: { defaults: Defaults; onDone: () => void }) {
  const options = useQuery(pickerOptions);
  const contacts = options.data?.contacts ?? [];
  const properties = options.data?.properties ?? [];
  const start = defaults.start ?? nextRoundHour();
  const [kind, setKind] = useState<AppointmentKind>(defaults.kind ?? "visita");
  const [day, setDay] = useState(toDateInput(start));
  const [time, setTime] = useState(toTimeInput(start));
  const [contactId, setContactId] = useState(defaults.contactId ?? "");
  const [propertyId, setPropertyId] = useState(defaults.propertyId ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) {
      setError(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const iso = new Date(`${day}T${time}`).toISOString();
    try {
      await createAppointment({ kind, start: iso, contactId, propertyId: propertyId || undefined, note: note || undefined });
    } catch (err) {
      setSaveError(friendlyError(err));
      setSaving(false);
      return;
    }
    const who = contacts.find((c) => c.id === contactId);
    toast.success("Appuntamento salvato", {
      description: `${appointmentKind[kind].label} con ${who ? fullName(who) : "il cliente"} alle ${time}`,
    });
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <p className="mb-2 text-[15px] font-medium">Che tipo di appuntamento?</p>
        <div className="grid grid-cols-3 gap-2">
          {(["visita", "valutazione", "firma"] as AppointmentKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-lg border text-[15px] font-medium transition-colors",
                kind === k ? "border-primary bg-primary-soft text-primary-strong" : "border-input hover:bg-muted",
              )}
            >
              <span className={cn("size-2.5 rounded-full", toneClasses[appointmentKind[k].tone].dot)} aria-hidden />
              {appointmentKind[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Giorno" htmlFor="ap-day">
          <Input id="ap-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
        </Field>
        <Field label="Ora" htmlFor="ap-time">
          <Input id="ap-time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
      </div>

      <Field label="Cliente" htmlFor="ap-contact">
        <Select
          id="ap-contact"
          value={contactId}
          onChange={(e) => {
            setContactId(e.target.value);
            setError(false);
          }}
          aria-invalid={error}
          className={cn(error && "border-destructive")}
        >
          <option value="">{options.loading ? "Caricamento…" : contacts.length ? "Scegli il cliente" : "Nessun contatto: aggiungine uno"}</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {fullName(c)}
            </option>
          ))}
        </Select>
        {error && <p className="mt-1.5 text-sm font-medium text-destructive">Scegli con chi è l'appuntamento</p>}
      </Field>

      <Field label="Immobile (se serve)" htmlFor="ap-property">
        <Select id="ap-property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">Nessun immobile</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}, {p.city}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Nota (facoltativa)" htmlFor="ap-note">
        <Textarea id="ap-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. portare le chiavi" className="min-h-20" />
      </Field>

      {options.error && <p className="text-sm font-medium text-destructive">{options.error}</p>}
      {saveError && (
        <p role="alert" className="rounded-lg bg-destructive-soft px-4 py-3 text-[15px] font-medium text-destructive">
          {saveError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={saving || options.loading}>
        {saving ? "Salvataggio…" : "Salva appuntamento"}
      </Button>
    </form>
  );
}

function nextRoundHour() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}
