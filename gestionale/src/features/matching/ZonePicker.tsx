import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useQuery } from "@/hooks/useQuery";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { addZone, listZones } from "@/services/api";

const NUOVA = "__nuova__";

/** Campo per scrivere una zona nuova e aggiungerla alla lista dell'agenzia. */
function NewZone({ onAdded, onCancel, id }: { onAdded: (name: string) => void; onCancel?: () => void; id: string }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      onAdded(await addZone(name));
      setName("");
    } catch (err) {
      toast.error("Zona non aggiunta", { description: friendlyError(err) });
    }
    setBusy(false);
  }

  return (
    <div className="mt-2 flex gap-2">
      <Input
        id={id}
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder="Es. Bari – Murat"
        aria-label="Nome della nuova zona"
      />
      <Button type="button" onClick={add} disabled={busy || name.trim().length < 2}>
        <Check aria-hidden />
        Aggiungi
      </Button>
      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annulla
        </Button>
      )}
    </div>
  );
}

/**
 * Zona di un immobile: si sceglie dalla lista dell'agenzia, così il matching
 * confronta sempre gli stessi nomi. Se manca, si aggiunge al volo.
 */
export function ZoneSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const zones = useQuery(listZones);
  const [adding, setAdding] = useState(false);
  const list = zones.data ?? [];
  const options = value && !list.includes(value) ? [value, ...list] : list;

  return (
    <div>
      <Select
        id={id}
        value={adding ? NUOVA : value}
        onChange={(e) => {
          if (e.target.value === NUOVA) setAdding(true);
          else {
            setAdding(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{zones.loading ? "Caricamento…" : "Scegli la zona"}</option>
        {options.map((z) => (
          <option key={z} value={z}>
            {z}
          </option>
        ))}
        <option value={NUOVA}>+ Aggiungi una nuova zona</option>
      </Select>
      {adding && (
        <NewZone
          id={`${id}-nuova`}
          onAdded={(name) => {
            onChange(name);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}

/** Zone in cui cerca un acquirente: se ne possono scegliere più di una. */
export function ZoneChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const zones = useQuery(listZones);
  const [adding, setAdding] = useState(false);
  const list = [...new Set([...(zones.data ?? []), ...value])];
  const toggle = (z: string) => onChange(value.includes(z) ? value.filter((x) => x !== z) : [...value, z]);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Zone">
        {list.map((z) => {
          const on = value.includes(z);
          return (
            <button
              key={z}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(z)}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium transition-colors",
                on ? "border-primary bg-primary-soft text-primary-strong" : "border-input bg-card hover:bg-muted",
              )}
            >
              {on && <Check className="size-4" aria-hidden />}
              {z}
            </button>
          );
        })}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-dashed border-input px-4 text-[15px] font-medium text-muted-foreground hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden />
            Nuova zona
          </button>
        )}
      </div>
      {adding && (
        <NewZone
          id="zona-nuova"
          onAdded={(name) => {
            if (!value.includes(name)) onChange([...value, name]);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {list.length === 0 && !adding && <p className="mt-2 text-sm text-muted-foreground">Nessuna zona ancora: aggiungi la prima.</p>}
    </div>
  );
}
