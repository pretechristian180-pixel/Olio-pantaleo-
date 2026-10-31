import { useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { FeatureChips, FeaturePicker } from "@/features/records/FeaturePicker";
import { ZoneChips } from "@/features/matching/ZonePicker";
import { friendlyError } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import { contactRoleLabel, contractLabel, kindLabel, sourceLabel, temperatureLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { deleteSearch, saveSearch, updateContact } from "@/services/api";
import type { Contact, ContactRole, ContactSource, Contract, PropertyKind, SearchCriteria, Temperature } from "@/types/domain";

const toNum = (s: string) => (s.replace(/[^\d]/g, "") ? Number(s.replace(/[^\d]/g, "")) : null);
const num = (v: number | null | undefined) => (v == null ? "" : String(v));

function More({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="flex h-11 items-center gap-1.5 font-semibold text-primary-strong" aria-expanded={open}>
      <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden />
      Altri dettagli
    </button>
  );
}

/* =====================================================================
 * Modifica del contatto
 * ===================================================================== */

export function EditContactButton({ contact }: { contact: Contact }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil aria-hidden />
        Modifica
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Modifica contatto">{open && <EditContactForm contact={contact} onDone={() => setOpen(false)} />}</DialogContent>
      </Dialog>
    </>
  );
}

function EditContactForm({ contact: c, onDone }: { contact: Contact; onDone: () => void }) {
  const [f, setF] = useState({
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    email: c.email ?? "",
    role: c.role,
    temperature: c.temperature,
    source: (c.source ?? "") as ContactSource | "",
    tags: (c.tags ?? []).join(", "),
    birthday: c.birthday ?? "",
    consent: c.marketingConsent ?? false,
    notes: c.notes ?? "",
  });
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.firstName.trim()) return toast.error("Scrivi il nome");
    setBusy(true);
    try {
      await updateContact(c.id, {
        firstName: f.firstName,
        lastName: f.lastName,
        phone: f.phone,
        email: f.email,
        role: f.role,
        temperature: f.temperature,
        source: f.source || null,
        tags: f.tags.split(","),
        birthday: f.birthday || null,
        marketingConsent: f.consent,
        notes: f.notes,
      });
      toast.success("Contatto aggiornato");
      onDone();
    } catch (err) {
      toast.error("Non salvato", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" htmlFor="ec-fn">
          <Input id="ec-fn" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label="Cognome" htmlFor="ec-ln">
          <Input id="ec-ln" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefono" htmlFor="ec-ph">
          <Input id="ec-ph" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="ec-em">
          <Input id="ec-em" type="email" inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Chi è" htmlFor="ec-role">
          <Select id="ec-role" value={f.role} onChange={(e) => set("role", e.target.value as ContactRole)}>
            {(Object.keys(contactRoleLabel) as ContactRole[]).map((r) => (
              <option key={r} value={r}>
                {contactRoleLabel[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quanto è interessato" htmlFor="ec-temp">
          <Select id="ec-temp" value={f.temperature} onChange={(e) => set("temperature", e.target.value as Temperature)}>
            {(Object.keys(temperatureLabel) as Temperature[]).map((t) => (
              <option key={t} value={t}>
                {temperatureLabel[t].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <More open={more} onToggle={() => setMore((m) => !m)} />
      {more && (
        <div className="space-y-4">
          <Field label="Etichette" htmlFor="ec-tags" hint="Separate da una virgola, es. investitore, prima casa, cliente passato">
            <Input id="ec-tags" value={f.tags} onChange={(e) => set("tags", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Da dove arriva" htmlFor="ec-src">
              <Select id="ec-src" value={f.source} onChange={(e) => set("source", e.target.value as ContactSource | "")}>
                <option value="">Non indicato</option>
                {(Object.keys(sourceLabel) as ContactSource[]).map((s) => (
                  <option key={s} value={s}>
                    {sourceLabel[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Compleanno" htmlFor="ec-bd">
              <Input id="ec-bd" type="date" value={f.birthday} onChange={(e) => set("birthday", e.target.value)} />
            </Field>
          </div>
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border bg-card px-4 py-3">
            <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5 size-5 accent-primary" />
            <span>
              <span className="block font-medium">Acconsente a ricevere comunicazioni</span>
              <span className="block text-sm text-muted-foreground">Auguri, novità e immobili consigliati. Senza consenso non riceve messaggi promozionali.</span>
            </span>
          </label>
          <Field label="Note" htmlFor="ec-notes">
            <Textarea id="ec-notes" className="min-h-20" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Salvataggio…" : "Salva"}
      </Button>
    </form>
  );
}

/* =====================================================================
 * Richieste del cliente (più di una)
 * ===================================================================== */

export function RequestsCard({ contact: c, canEdit, hint }: { contact: Contact; canEdit: boolean; hint: string }) {
  const [editing, setEditing] = useState<SearchCriteria | "new" | null>(null);
  const list = c.searches ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{list.length > 1 ? "Cosa cerca" : "Cosa cerca"}</CardTitle>
        <span className="text-muted-foreground">{hint}</span>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.length === 0 && <p className="text-muted-foreground">Nessuna richiesta: indica zona, budget e metri quadri e Mattonio troverà gli immobili giusti.</p>}
        {list.map((s, i) => (
          <div key={s.id ?? i} className={cn("rounded-lg border p-4", s.active === false && "opacity-60")}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{s.name || (list.length > 1 ? `Richiesta ${i + 1}` : "Richiesta")}</p>
              {s.contract && <Badge tone="navy" dot={false}>{contractLabel[s.contract]}</Badge>}
              {s.active === false && <Badge tone="gray">In pausa</Badge>}
              {canEdit && (
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setEditing(s)}>
                  <Pencil aria-hidden />
                  Modifica
                </Button>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[15px] sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-sm text-muted-foreground">Zona</dt>
                <dd>{s.zones.join(" · ") || "Qualsiasi"}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{s.contract === "affitto" ? "Affitto massimo" : "Budget massimo"}</dt>
                <dd>{s.budgetMax != null ? formatPrice(s.budgetMax, s.contract === "affitto") : "Non indicato"}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Almeno</dt>
                <dd>
                  {s.sqmMin != null ? `${s.sqmMin} mq` : "–"}
                  {s.roomsMin != null ? ` · ${s.roomsMin} locali` : ""}
                </dd>
              </div>
            </dl>
            {s.kind && <p className="mt-1 text-[15px] text-muted-foreground">Tipo: {kindLabel[s.kind]}</p>}
            <FeatureChips features={s.features ?? []} className="mt-2" />
            {s.notes && <p className="mt-2 text-[15px] italic text-foreground/80">“{s.notes}”</p>}
          </div>
        ))}
        {canEdit && (
          <Button variant="outline" className="w-full" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {list.length ? "Aggiungi un'altra richiesta" : "Aggiungi cosa cerca"}
          </Button>
        )}
      </CardContent>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing === "new" ? "Nuova richiesta" : "Modifica richiesta"} description="Il matching usa zona, budget, metri quadri e caratteristiche.">
          {editing !== null && <RequestForm contactId={c.id} initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RequestForm({ contactId, initial, onDone }: { contactId: string; initial?: SearchCriteria; onDone: () => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    contract: (initial?.contract ?? "vendita") as Contract,
    zones: initial?.zones ?? [],
    budgetMax: num(initial?.budgetMax),
    sqmMin: num(initial?.sqmMin),
    kind: (initial?.kind ?? "") as PropertyKind | "",
    budgetMin: num(initial?.budgetMin),
    roomsMin: num(initial?.roomsMin),
    features: initial?.features ?? [],
    notes: initial?.notes ?? "",
    active: initial?.active ?? true,
  });
  const [more, setMore] = useState(Boolean(initial?.features?.length || initial?.roomsMin || initial?.budgetMin || initial?.notes));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveSearch(contactId, {
        id: initial?.id,
        name: f.name,
        contract: f.contract,
        zones: f.zones,
        budgetMax: toNum(f.budgetMax),
        budgetMin: toNum(f.budgetMin),
        sqmMin: toNum(f.sqmMin),
        roomsMin: toNum(f.roomsMin),
        kind: f.kind || null,
        features: f.features,
        notes: f.notes,
        active: f.active,
      });
      toast.success("Richiesta salvata", { description: "Il matching si aggiorna da solo." });
      onDone();
    } catch (err) {
      toast.error("Non salvata", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial?.id || !window.confirm("Eliminare questa richiesta?")) return;
    try {
      await deleteSearch(initial.id);
      toast.success("Richiesta eliminata");
      onDone();
    } catch (err) {
      toast.error("Non eliminata", { description: friendlyError(err) });
    }
  }

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Compra o affitta" htmlFor="rq-ct">
          <Select id="rq-ct" value={f.contract} onChange={(e) => set("contract", e.target.value as Contract)}>
            <option value="vendita">Compra</option>
            <option value="affitto">Affitta</option>
          </Select>
        </Field>
        <Field label="Tipo" htmlFor="rq-kind">
          <Select id="rq-kind" value={f.kind} onChange={(e) => set("kind", e.target.value as PropertyKind | "")}>
            <option value="">Qualsiasi</option>
            {(Object.keys(kindLabel) as PropertyKind[]).map((k) => (
              <option key={k} value={k}>
                {kindLabel[k]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Zone">
        <ZoneChips value={f.zones} onChange={(v) => set("zones", v)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={f.contract === "affitto" ? "Affitto massimo (€/mese)" : "Budget massimo (€)"} htmlFor="rq-bmax">
          <Input id="rq-bmax" inputMode="numeric" value={f.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} />
        </Field>
        <Field label="Metri quadri minimi" htmlFor="rq-mq">
          <Input id="rq-mq" inputMode="numeric" value={f.sqmMin} onChange={(e) => set("sqmMin", e.target.value)} />
        </Field>
      </div>
      <More open={more} onToggle={() => setMore((m) => !m)} />
      {more && (
        <div className="space-y-4">
          <FeaturePicker label="Caratteristiche che desidera" value={f.features} onChange={(v) => set("features", v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Locali minimi" htmlFor="rq-rooms">
              <Input id="rq-rooms" inputMode="numeric" value={f.roomsMin} onChange={(e) => set("roomsMin", e.target.value)} />
            </Field>
            <Field label="Budget minimo (€)" htmlFor="rq-bmin">
              <Input id="rq-bmin" inputMode="numeric" value={f.budgetMin} onChange={(e) => set("budgetMin", e.target.value)} />
            </Field>
          </div>
          <Field label="Nome della richiesta (facoltativo)" htmlFor="rq-name" hint="Utile se ne ha più di una, es. «Casa al mare»">
            <Input id="rq-name" value={f.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Altre esigenze" htmlFor="rq-notes">
            <Textarea id="rq-notes" className="min-h-20" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Es. vicino alle scuole, niente piano terra" />
          </Field>
          {initial && (
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-card px-4">
              <input type="checkbox" checked={!f.active} onChange={(e) => set("active", !e.target.checked)} className="size-5 accent-primary" />
              Metti in pausa (non cercare immobili per questa richiesta)
            </label>
          )}
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Salvataggio…" : "Salva la richiesta"}
      </Button>
      {initial?.id && (
        <Button type="button" variant="ghost" className="w-full text-destructive" onClick={remove}>
          <Trash2 aria-hidden />
          Elimina richiesta
        </Button>
      )}
    </form>
  );
}
