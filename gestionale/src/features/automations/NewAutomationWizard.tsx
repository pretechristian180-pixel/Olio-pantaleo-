import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { friendlyError } from "@/lib/errors";
import { appointmentKind, contactRoleLabel, sourceLabel, stages, statusLabel, temperatureLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { createAutomation } from "@/services/automations";
import { acqPhases } from "@/features/acquisitions/labels";
import type { ActionKind, Automation, NewAutomation, Recipient, TriggerEntity, TriggerKind, WaitUnit } from "@/types/automations";
import { MessagePreview, VariableChips } from "./AutomationEditor";
import { fill, unitLabel, waitText } from "./labels";

/* ---------- Le situazioni che il motore sa riconoscere ---------- */
type Timing = "attesa" | "prima" | "giorni" | "giorni_prima" | "nessuna";
type Detail = "fase_trattativa" | "fase_acquisizione" | "stato_immobile" | "tipo_appuntamento" | "festa";
interface Situation {
  id: string;
  group: string;
  label: string;
  phrase: string;
  trigger: TriggerKind;
  entity: TriggerEntity;
  detail?: Detail;
  timing: Timing;
  wait?: [number, WaitUnit];
  extra?: Record<string, unknown>;
  consent?: boolean;
  note?: string;
}

const situations: Situation[] = [
  { id: "nuovo_lead", group: "Quando arriva qualcosa di nuovo", label: "Arriva un nuovo lead (sito, portali, social)", phrase: "Quando arriva un nuovo lead", trigger: "creazione", entity: "lead", timing: "attesa", wait: [0, "minuti"] },
  { id: "nuovo_contatto", group: "Quando arriva qualcosa di nuovo", label: "Aggiungi un nuovo contatto", phrase: "Quando arriva un nuovo contatto", trigger: "creazione", entity: "contact", timing: "attesa", wait: [0, "minuti"] },
  { id: "nuovo_immobile", group: "Quando arriva qualcosa di nuovo", label: "Entra un nuovo immobile", phrase: "Quando entra un nuovo immobile", trigger: "creazione", entity: "property", timing: "attesa", wait: [0, "minuti"] },
  { id: "immobile_adatto", group: "Quando arriva qualcosa di nuovo", label: "C'è un immobile adatto a un cliente", phrase: "Quando un immobile è adatto a un cliente", trigger: "creazione", entity: "match", timing: "attesa", wait: [30, "minuti"] },
  { id: "fase_trattativa", group: "Quando qualcosa cambia", label: "Una trattativa passa a una fase", phrase: "Quando una trattativa passa a", trigger: "cambio_fase", entity: "deal", detail: "fase_trattativa", timing: "attesa", wait: [0, "minuti"] },
  { id: "fase_acquisizione", group: "Quando qualcosa cambia", label: "Un'acquisizione passa a una fase", phrase: "Quando un'acquisizione passa a", trigger: "cambio_fase", entity: "acquisition", detail: "fase_acquisizione", timing: "attesa", wait: [0, "minuti"] },
  { id: "stato_immobile", group: "Quando qualcosa cambia", label: "Un immobile cambia stato", phrase: "Quando un immobile passa a", trigger: "cambio_fase", entity: "property", detail: "stato_immobile", timing: "attesa", wait: [0, "minuti"] },
  { id: "prima_appuntamento", group: "Appuntamenti", label: "Prima di un appuntamento", phrase: "Prima di ogni appuntamento", trigger: "data_evento", entity: "appointment", detail: "tipo_appuntamento", timing: "prima", wait: [24, "ore"] },
  { id: "dopo_appuntamento", group: "Appuntamenti", label: "Dopo un appuntamento", phrase: "Dopo ogni appuntamento", trigger: "data_evento", entity: "appointment", detail: "tipo_appuntamento", timing: "attesa", wait: [1, "giorni_lavorativi"] },
  { id: "lead_non_richiamato", group: "Quando nessuno si muove", label: "Un lead non viene richiamato", phrase: "Se nessuno richiama un nuovo lead", trigger: "nessuna_risposta", entity: "lead", timing: "attesa", wait: [2, "ore_lavorative"], note: "Si annulla da sola appena qualcuno chiama o scrive al cliente." },
  { id: "cliente_non_sentito", group: "Quando nessuno si muove", label: "Un cliente non viene sentito da tempo", phrase: "Se un cliente non viene sentito", trigger: "inattivita", entity: "contact", timing: "giorni", wait: [30, "giorni"], note: "Vale per chi cerca casa e non è freddo." },
  { id: "immobile_senza_visite", group: "Quando nessuno si muove", label: "Un immobile non riceve visite", phrase: "Se un immobile disponibile non riceve visite", trigger: "inattivita", entity: "property", timing: "giorni", wait: [21, "giorni"] },
  { id: "periodico_immobile", group: "Date e scadenze", label: "Ogni tot giorni, per ogni immobile disponibile", phrase: "Per ogni immobile disponibile con proprietario, a intervalli regolari", trigger: "periodico", entity: "property", timing: "giorni", wait: [15, "giorni"] },
  { id: "scadenza_incarico", group: "Date e scadenze", label: "Si avvicina la scadenza dell'incarico", phrase: "Prima della scadenza dell'incarico", trigger: "data_campo", entity: "property", timing: "giorni_prima", wait: [30, "giorni"], extra: { campo: "scadenza_incarico" } },
  { id: "compleanno", group: "Date e scadenze", label: "È il compleanno di un contatto", phrase: "Il giorno del compleanno di un contatto", trigger: "data_campo", entity: "contact", timing: "nessuna", wait: [0, "giorni"], extra: { campo: "data_nascita" }, consent: true },
  { id: "festivita", group: "Date e scadenze", label: "Arriva una festività", phrase: "Per le feste", trigger: "data_fissa", entity: "contact", detail: "festa", timing: "nessuna", wait: [0, "giorni"], consent: true, note: "Natale il 23 dicembre, Pasqua il sabato prima, Capodanno il 31 dicembre." },
];

const groups = [...new Set(situations.map((s) => s.group))];

const details: Record<Detail, { key: string; label: string; options: { value: string; label: string }[] }> = {
  fase_trattativa: { key: "fase", label: "Quale fase", options: [...stages.map((s) => ({ value: s.id, label: s.label })), { value: "persa", label: "Persa" }] },
  fase_acquisizione: { key: "fase", label: "Quale fase", options: [...acqPhases.map((p) => ({ value: p.id, label: p.label })), { value: "persa", label: "Persa" }] },
  stato_immobile: { key: "stato", label: "Quale stato", options: Object.entries(statusLabel).map(([k, v]) => ({ value: k, label: v.label })) },
  tipo_appuntamento: { key: "tipo", label: "Di che tipo", options: Object.entries(appointmentKind).map(([k, v]) => ({ value: k, label: v.label })) },
  festa: { key: "festa", label: "Quale festa", options: [{ value: "natale", label: "Natale" }, { value: "pasqua", label: "Pasqua" }, { value: "capodanno", label: "Capodanno" }] },
};

/* ---------- Filtri "per chi" ---------- */
type FilterKey = "tipo" | "fonte" | "temperatura" | "canale" | "contratto";
const filterDefs: Record<FilterKey, { label: string; options: { value: string; label: string }[] }> = {
  tipo: { label: "Che tipo di contatto", options: Object.entries(contactRoleLabel).map(([k, v]) => ({ value: k, label: v })) },
  fonte: { label: "Da dove arriva", options: Object.entries(sourceLabel).map(([k, v]) => ({ value: k, label: v })) },
  temperatura: { label: "Quanto è interessato", options: Object.entries(temperatureLabel).map(([k, v]) => ({ value: k, label: v.label })) },
  canale: { label: "Da dove arriva il lead", options: [{ value: "sito", label: "Sito" }, { value: "portale", label: "Portali" }, { value: "facebook", label: "Facebook" }, { value: "instagram", label: "Instagram" }, { value: "email", label: "Email" }] },
  contratto: { label: "Vendita o affitto", options: [{ value: "vendita", label: "Vendita" }, { value: "affitto", label: "Affitto" }] },
};
const filtersFor = (s: Situation): FilterKey[] =>
  s.entity === "contact" ? ["tipo", "fonte", "temperatura"] : s.entity === "lead" ? ["canale"] : s.entity === "property" ? ["contratto"] : [];

/* ---------- Azioni ---------- */
interface Choice {
  id: string;
  label: string;
  action: ActionKind;
  recipient: Recipient;
}
function choicesFor(s: Situation): Choice[] {
  const owner = s.entity === "property" || s.entity === "acquisition";
  const out: Choice[] = owner
    ? [
        { id: "wa_prop", label: "Mandiamo un WhatsApp al proprietario", action: "whatsapp", recipient: "proprietario" },
        { id: "mail_prop", label: "Mandiamo un'email al proprietario", action: "email", recipient: "proprietario" },
      ]
    : [
        { id: "wa", label: "Mandiamo un WhatsApp al cliente", action: "whatsapp", recipient: "contatto" },
        { id: "mail", label: "Mandiamo un'email al cliente", action: "email", recipient: "contatto" },
      ];
  out.push(
    { id: "task", label: "Creiamo una cosa da fare per l'agente", action: "task", recipient: "agente_assegnato" },
    { id: "avviso", label: "Avvisiamo il titolare", action: "notifica_interna", recipient: "titolare" },
  );
  if (!owner && s.entity !== "property") out.push({ id: "temp", label: "Cambiamo l'interesse del cliente", action: "cambio_temperatura", recipient: "contatto" });
  return out;
}

const variablesFor = (s: Situation) => {
  const k = ["nome", "nome_agente", "nome_agenzia"];
  if (["property", "appointment", "match", "deal", "acquisition"].includes(s.entity)) k.push("indirizzo_immobile", "prezzo_immobile");
  if (s.entity === "appointment") k.push("data_appuntamento", "ora_appuntamento");
  if (s.id === "scadenza_incarico") k.push("data_scadenza");
  if (s.id === "festivita") k.push("festivita");
  if (s.id === "periodico_immobile" || s.id === "immobile_senza_visite") k.push("visite", "richieste", "giorni_online");
  if (s.id === "lead_non_richiamato") k.push("ora_creazione");
  k.push("link_recensioni");
  return k;
};

const units: WaitUnit[] = ["minuti", "ore", "ore_lavorative", "giorni", "giorni_lavorativi"];

/** Da un'automazione esistente alla situazione del creatore (per "Duplica e modifica") */
function situationOf(a: Automation): Situation | undefined {
  const c = a.conditions as Record<string, unknown>;
  return situations.find(
    (s) =>
      s.trigger === a.trigger &&
      s.entity === a.entity &&
      (!s.extra?.campo || s.extra.campo === c.campo) &&
      (s.entity !== "appointment" || (s.timing === "prima") === (a.waitDirection === "prima")),
  );
}

const steps = ["Quando", "Per chi", "Cosa fare", "Controlla"];

/** Crea un'automazione: quando → per chi → cosa fare → controlla. Frasi semplici, mai codice. */
export function NewAutomationWizard({ onDone, from }: { onDone: () => void; from?: Automation }) {
  const start = from ? situationOf(from) : undefined;
  const fc = (from?.conditions ?? {}) as Record<string, unknown>;
  const [step, setStep] = useState(1);
  const [sit, setSit] = useState<Situation>(start ?? situations[0]);
  const [detail, setDetail] = useState<string>(start?.detail ? String(fc[details[start.detail].key] ?? "") : "");
  const [waitValue, setWaitValue] = useState(String(from ? from.waitValue : (situations[0].wait?.[0] ?? 0)));
  const [waitUnit, setWaitUnit] = useState<WaitUnit>(from?.waitUnit ?? situations[0].wait?.[1] ?? "minuti");
  const [filters, setFilters] = useState<Partial<Record<FilterKey, string[]>>>(() =>
    Object.fromEntries((Object.keys(filterDefs) as FilterKey[]).filter((k) => Array.isArray(fc[k]) && start?.entity !== "appointment").map((k) => [k, fc[k] as string[]])),
  );
  const [consent, setConsent] = useState(from?.needsConsent ?? false);
  const initialChoice = from ? choicesFor(start ?? situations[0]).find((c) => c.action === from.action && (c.recipient === from.recipient || c.action === "task" || c.action === "notifica_interna")) : undefined;
  const [choice, setChoice] = useState<string>(initialChoice?.id ?? choicesFor(start ?? situations[0])[0].id);
  const [text, setText] = useState(from ? (from.template?.text ?? from.content.titolo ?? "") : "");
  const [subject, setSubject] = useState(from?.template?.subject ?? "");
  const [temperature, setTemperature] = useState(from?.content.temperatura ?? "freddo");
  const [name, setName] = useState(from ? `${from.name} (copia)` : "");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const det = sit.detail ? details[sit.detail] : null;
  const detailValue = detail || det?.options[0]?.value || "";
  const detailLabel = det?.options.find((o) => o.value === detailValue)?.label ?? "";
  const choices = choicesFor(sit);
  const ch = choices.find((c) => c.id === choice) ?? choices[0];
  const message = ch.action === "whatsapp" || ch.action === "email";
  const mustConsent = !!sit.consent;
  const n = Math.max(0, Number(waitValue) || 0);
  const filterKeys = filtersFor(sit);

  function pick(s: Situation) {
    setSit(s);
    setDetail("");
    setWaitValue(String(s.wait?.[0] ?? 0));
    setWaitUnit(s.wait?.[1] ?? "minuti");
    setFilters({});
    setConsent(!!s.consent);
    setChoice(choicesFor(s)[0].id);
  }

  const when = (() => {
    const base = sit.detail && sit.detail !== "festa" ? `${sit.phrase} "${detailLabel}"` : sit.detail === "festa" ? `${sit.phrase} (${detailLabel})` : sit.phrase;
    if (sit.timing === "nessuna") return base;
    if (sit.timing === "giorni") return sit.id === "periodico_immobile" ? `${base}, ogni ${n} giorni` : `${base} da ${n} giorni`;
    if (sit.timing === "giorni_prima") return `${n} giorni prima della scadenza dell'incarico`;
    const w = waitText(n, waitUnit);
    return sit.timing === "prima" ? `${w === "subito" ? "All'inizio di" : `${w} prima di`} ogni appuntamento "${detailLabel}"` : `${base}, ${w === "subito" ? "subito" : `dopo ${w}`}`;
  })();
  const whom = filterKeys
    .filter((k) => filters[k]?.length)
    .map((k) => filters[k]!.map((v) => filterDefs[k].options.find((o) => o.value === v)?.label.toLowerCase()).join(" o "))
    .join(", ");
  const summary = `${when}${whom ? ` (solo: ${whom})` : ""}: ${ch.action === "cambio_temperatura" ? `cambiamo l'interesse del cliente in "${temperatureLabel[temperature as keyof typeof temperatureLabel]?.label.toLowerCase()}"` : ch.label.charAt(0).toLowerCase() + ch.label.slice(1)}.`;

  function next() {
    if (step === 3 && ch.action !== "cambio_temperatura" && !text.trim()) return toast.error(message ? "Scrivi il messaggio" : "Scrivi il testo");
    if (step === 3 && ch.action === "email" && !subject.trim()) return toast.error("Scrivi l'oggetto dell'email");
    setStep((s) => s + 1);
  }

  async function save() {
    const conditions: Record<string, unknown> = { ...(sit.extra ?? {}) };
    if (det) conditions[det.key] = detailValue;
    if (sit.timing === "giorni") conditions.giorni = Math.max(1, n);
    for (const k of filterKeys) if (filters[k]?.length) conditions[k] = filters[k];
    const payload: NewAutomation = {
      name: name.trim() || summary.slice(0, 120),
      trigger: sit.trigger,
      entity: sit.entity,
      conditions,
      waitValue: sit.timing === "nessuna" ? 0 : sit.timing === "giorni" ? Math.max(1, n) : n,
      waitUnit: sit.timing === "giorni" || sit.timing === "giorni_prima" || sit.timing === "nessuna" ? "giorni" : waitUnit,
      waitDirection: sit.timing === "prima" || sit.timing === "giorni_prima" ? "prima" : "dopo",
      action: ch.action,
      recipient: ch.recipient,
      text: ch.action === "cambio_temperatura" ? "" : text,
      subject,
      needsConsent: mustConsent || consent,
      active,
      temperature: ch.action === "cambio_temperatura" ? temperature : undefined,
    };
    setBusy(true);
    try {
      await createAutomation(payload);
      toast.success(active ? "Automazione creata e accesa" : "Automazione creata (spenta)", { description: payload.name });
      onDone();
    } catch (err) {
      toast.error("Non creata", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Passaggi">
        {steps.map((l, i) => (
          <li
            key={l}
            aria-current={step === i + 1 ? "step" : undefined}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border px-1 text-center text-[14px] font-semibold",
              step === i + 1 ? "border-primary bg-primary-soft text-primary-strong" : step > i + 1 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {step > i + 1 && <Check className="mr-1 size-4" aria-hidden />}
            {l}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-4">
          {groups.map((g) => (
            <fieldset key={g} className="space-y-2">
              <legend className="mb-1 text-[15px] font-semibold text-muted-foreground">{g}</legend>
              {situations
                .filter((s) => s.group === g)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={sit.id === s.id}
                    onClick={() => pick(s)}
                    className={cn("flex min-h-12 w-full items-center rounded-lg border px-4 py-2 text-left text-[17px]", sit.id === s.id ? "border-primary bg-primary-soft font-semibold text-primary-strong" : "bg-card")}
                  >
                    {s.label}
                  </button>
                ))}
            </fieldset>
          ))}

          <div className="sticky bottom-0 space-y-3 rounded-lg border bg-background p-3 shadow-card">
            {det && (
              <Field label={det.label} htmlFor="nw-det">
                <Select id="nw-det" value={detailValue} onChange={(e) => setDetail(e.target.value)}>
                  {det.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {(sit.timing === "attesa" || sit.timing === "prima") && (
              <fieldset>
                <legend className="mb-2 text-[15px] font-medium">{sit.timing === "prima" ? "Quanto prima" : "Quanto aspettiamo (0 = subito)"}</legend>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <Input inputMode="numeric" value={waitValue} onChange={(e) => setWaitValue(e.target.value.replace(/\D/g, "").slice(0, 3))} aria-label="Quanto" />
                  <Select value={waitUnit} onChange={(e) => setWaitUnit(e.target.value as WaitUnit)} aria-label="Unità">
                    {units.map((u) => (
                      <option key={u} value={u}>
                        {unitLabel[u].many}
                      </option>
                    ))}
                  </Select>
                </div>
              </fieldset>
            )}
            {(sit.timing === "giorni" || sit.timing === "giorni_prima") && (
              <Field label={sit.id === "periodico_immobile" ? "Ogni quanti giorni" : sit.timing === "giorni_prima" ? "Quanti giorni prima" : "Da quanti giorni"} htmlFor="nw-days">
                <Input id="nw-days" inputMode="numeric" value={waitValue} onChange={(e) => setWaitValue(e.target.value.replace(/\D/g, "").slice(0, 3))} />
              </Field>
            )}
            <p className="text-[15px]">{when}…</p>
            {sit.note && <p className="text-sm text-muted-foreground">{sit.note}</p>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          {filterKeys.length ? (
            <>
              <p className="text-[17px]">Vale per tutti, oppure solo per alcuni? Se non scegli nulla, vale per tutti.</p>
              {filterKeys.map((k) => (
                <fieldset key={k}>
                  <legend className="mb-2 text-[15px] font-medium">{filterDefs[k].label}</legend>
                  <div className="flex flex-wrap gap-2">
                    {filterDefs[k].options.map((o) => {
                      const on = filters[k]?.includes(o.value) ?? false;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setFilters((f) => ({ ...f, [k]: on ? (f[k] ?? []).filter((x) => x !== o.value) : [...(f[k] ?? []), o.value] }))}
                          className={cn("inline-flex h-12 items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium", on ? "border-primary bg-primary text-white" : "bg-card")}
                        >
                          {on && <Check className="size-4" aria-hidden />}
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </>
          ) : (
            <p className="text-[17px]">Questa automazione vale per {sit.entity === "appointment" ? "tutti gli appuntamenti del tipo scelto" : sit.entity === "deal" ? "tutte le trattative" : sit.entity === "acquisition" ? "tutte le acquisizioni" : "tutti"}. Non ci sono altre scelte da fare.</p>
          )}
          <label className="flex min-h-12 items-start gap-3 rounded-lg border bg-card p-4">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--color-primary)]" checked={mustConsent || consent} disabled={mustConsent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              <span className="block text-[17px] font-medium">Solo ai contatti che hanno dato il consenso alle comunicazioni</span>
              <span className="block text-[15px] text-muted-foreground">
                {mustConsent ? "Obbligatorio per auguri e messaggi promozionali." : "Consigliato per offerte e messaggi non legati a una richiesta del cliente."}
              </span>
            </span>
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-2" role="radiogroup" aria-label="Cosa fare">
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={ch.id === c.id}
                onClick={() => setChoice(c.id)}
                className={cn("flex min-h-12 w-full items-center rounded-lg border px-4 py-2 text-left text-[17px]", ch.id === c.id ? "border-primary bg-primary-soft font-semibold text-primary-strong" : "bg-card")}
              >
                {c.label}
              </button>
            ))}
          </div>
          {ch.action === "cambio_temperatura" ? (
            <Field label="Nuovo interesse" htmlFor="nw-temp">
              <Select id="nw-temp" value={temperature} onChange={(e) => setTemperature(e.target.value)}>
                {Object.entries(temperatureLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}: {v.hint.toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <>
              {ch.action === "email" && (
                <Field label="Oggetto dell'email" htmlFor="nw-sub">
                  <Input id="nw-sub" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
                </Field>
              )}
              <Field label={message ? "Messaggio" : ch.action === "notifica_interna" ? "Testo dell'avviso" : "Cosa deve fare l'agente"} htmlFor="nw-text">
                {message ? (
                  <Textarea id="nw-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Ciao {{nome}}, …" className="min-h-32" />
                ) : (
                  <Input id="nw-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={250} placeholder="Es. Chiama {{nome}} per un aggiornamento" />
                )}
              </Field>
              <VariableChips onInsert={(k) => setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}{{${k}}}`)} keys={variablesFor(sit)} />
              {text && (message ? <MessagePreview text={text} channel={ch.action as "whatsapp" | "email"} subject={subject} /> : <p className="rounded-lg bg-muted px-4 py-3">{fill(text)}</p>)}
              {ch.action === "whatsapp" && (
                <p className="text-[15px] text-muted-foreground">
                  Per i WhatsApp serve un modello approvato da Meta: finché non lo è, mandiamo un'email o creiamo una cosa da fare per l'agente.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-muted px-4 py-3">
            <p className="text-[15px] font-medium text-muted-foreground">Ecco cosa farà</p>
            <p className="mt-1 text-[17px]">{summary}</p>
            {(mustConsent || consent) && <p className="mt-1 text-[15px] text-muted-foreground">Solo ai contatti con il consenso alle comunicazioni.</p>}
          </div>
          <Field label="Nome dell'automazione (facoltativo)" htmlFor="nw-name">
            <Input id="nw-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Lo scriviamo noi se lo lasci vuoto" />
          </Field>
          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-medium">Accendila subito</p>
              <p className="text-[15px] text-muted-foreground">Puoi spegnerla quando vuoi. I messaggi non partono mai tra le 21 e le 8:30 né la domenica.</p>
            </div>
            <Switch on={active} onChange={() => setActive((a) => !a)} label="accendila subito" />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {step > 1 && (
          <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            <ArrowLeft aria-hidden />
            Indietro
          </Button>
        )}
        {step < 4 ? (
          <Button size="lg" className="flex-1" onClick={next}>
            Avanti
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={save} disabled={busy}>
            <Check aria-hidden />
            {busy ? "Salvo…" : "Crea automazione"}
          </Button>
        )}
      </div>
    </div>
  );
}
