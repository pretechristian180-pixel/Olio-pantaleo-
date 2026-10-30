import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { FileSignature } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { kindLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { addOwner, setAcquisitionPhase, updateAcquisition } from "@/services/acquisitions";
import type { PropertyKind } from "@/types/domain";
import type { AcqPhase, Acquisition, LossReason } from "@/types/acquisitions";
import { lossLabel, phaseLabel } from "./labels";

type Pending = { acquisition: Acquisition; to: "persa" | "incarico_firmato" } | null;

const Ctx = createContext<(a: Acquisition, to: AcqPhase) => void>(() => undefined);

/** Sposta un'acquisizione di fase. "Persa" e "Incarico firmato" chiedono prima le informazioni mancanti. */
export function useMoveAcquisition() {
  return useContext(Ctx);
}

export function AcquisitionMoverProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending>(null);

  const move = useCallback((a: Acquisition, to: AcqPhase) => {
    if (a.phase === to) return;
    if (!a.canEdit) {
      toast.error("Non puoi spostare questa acquisizione", { description: "Puoi spostare solo quelle assegnate a te." });
      return;
    }
    if (a.phase === "incarico_firmato") {
      toast.error("L'incarico è già firmato", { description: "L'immobile è tra gli Immobili." });
      return;
    }
    if (to === "persa" || to === "incarico_firmato") {
      setPending({ acquisition: a, to });
      return;
    }
    const from = a.phase;
    setAcquisitionPhase(a.id, to)
      .then(() =>
        toast.success(`${a.address}: ${phaseLabel(to)}`, {
          action: from !== "persa" ? { label: "Annulla", onClick: () => setAcquisitionPhase(a.id, from).catch((e) => toast.error(friendlyError(e))) } : undefined,
        }),
      )
      .catch((err) => toast.error("Acquisizione non spostata", { description: friendlyError(err) }));
  }, []);

  const close = () => setPending(null);
  return (
    <Ctx.Provider value={move}>
      {children}
      <Dialog open={pending?.to === "persa"} onOpenChange={(o) => !o && close()}>
        <DialogContent title="Perché è persa?" description={pending?.acquisition.address}>
          {pending?.to === "persa" && <LostForm acquisition={pending.acquisition} onDone={close} />}
        </DialogContent>
      </Dialog>
      <Dialog open={pending?.to === "incarico_firmato"} onOpenChange={(o) => !o && close()}>
        <DialogContent title="Incarico firmato!" description="Completa questi dati: creiamo subito l'immobile e poi aggiungi le foto.">
          {pending?.to === "incarico_firmato" && <SignForm acquisition={pending.acquisition} onDone={close} />}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

function LostForm({ acquisition: a, onDone }: { acquisition: Acquisition; onDone: () => void }) {
  const [reason, setReason] = useState<LossReason | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!reason) return toast.error("Scegli il motivo");
    setBusy(true);
    try {
      await setAcquisitionPhase(a.id, "persa", reason);
      toast.success("Segnata come persa", { description: lossLabel[reason] });
      onDone();
    } catch (err) {
      toast.error("Non salvata", { description: friendlyError(err) });
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      {(Object.keys(lossLabel) as LossReason[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setReason(r)}
          aria-pressed={reason === r}
          className={cn(
            "flex h-14 w-full items-center rounded-lg border px-4 text-left text-[17px] font-medium",
            reason === r ? "border-primary bg-primary-soft text-primary-strong" : "bg-card",
          )}
        >
          {lossLabel[r]}
        </button>
      ))}
      <Button size="lg" className="mt-2 w-full" onClick={save} disabled={busy || !reason}>
        {busy ? "Salvataggio…" : "Segna come persa"}
      </Button>
    </div>
  );
}

function SignForm({ acquisition: a, onDone }: { acquisition: Acquisition; onDone: () => void }) {
  const navigate = useNavigate();
  const [f, setF] = useState({
    owner: "",
    phone: "",
    city: a.city,
    kind: (a.kind ?? "appartamento") as PropertyKind,
    sqm: a.sqm ? String(a.sqm) : "",
    price: String(a.valuedPrice ?? a.askingPrice ?? ""),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(f.price.replace(/[^\d]/g, ""));
    if (!a.contactId && f.owner.trim().length < 2) return toast.error("Scrivi il nome del proprietario");
    if (!f.city.trim()) return toast.error("Scrivi la città");
    if (!price) return toast.error("Scrivi il prezzo dell'incarico");
    setBusy(true);
    try {
      if (!a.contactId) await addOwner(a.id, f.owner, f.phone);
      await updateAcquisition(a.id, {
        city: f.city,
        kind: f.kind,
        sqm: Number(f.sqm.replace(/[^\d]/g, "")) || null,
        valuedPrice: price,
      });
      const pid = await setAcquisitionPhase(a.id, "incarico_firmato");
      toast.success("Complimenti, incarico firmato!", { description: "L'immobile è stato creato: ora aggiungi le foto." });
      onDone();
      if (pid) navigate(`/immobili/${pid}/foto`);
    } catch (err) {
      toast.error("Incarico non salvato", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      {!a.contactId && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Proprietario" htmlFor="sg-owner">
            <Input id="sg-owner" value={f.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Nome e cognome" autoComplete="name" />
          </Field>
          <Field label="Telefono" htmlFor="sg-phone">
            <Input id="sg-phone" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Città" htmlFor="sg-city">
          <Input id="sg-city" value={f.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Tipo" htmlFor="sg-kind">
          <Select id="sg-kind" value={f.kind} onChange={(e) => set("kind", e.target.value)}>
            {(Object.keys(kindLabel) as PropertyKind[]).map((k) => (
              <option key={k} value={k}>
                {kindLabel[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Metri quadri" htmlFor="sg-sqm">
          <Input id="sg-sqm" inputMode="numeric" value={f.sqm} onChange={(e) => set("sqm", e.target.value)} />
        </Field>
        <Field label="Prezzo di vendita (€)" htmlFor="sg-price">
          <Input id="sg-price" inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value)} />
        </Field>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        <FileSignature aria-hidden />
        {busy ? "Creo l'immobile…" : "Crea l'immobile e aggiungi le foto"}
      </Button>
    </form>
  );
}
