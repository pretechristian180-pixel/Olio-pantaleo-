import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { appointmentKind, stages, statusLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { createAutomation } from "@/services/automations";
import { acqPhases } from "@/features/acquisitions/labels";
import type { ActionKind, NewAutomation, TriggerEntity, TriggerKind, WaitUnit } from "@/types/automations";
import { MessagePreview, VariableChips } from "./AutomationEditor";
import { fill, unitLabel, waitText } from "./labels";

type When = "nuovo_contatto" | "fase_trattativa" | "fase_acquisizione" | "prima_appuntamento" | "dopo_appuntamento" | "stato_immobile";

const whenOptions: { id: When; label: string; trigger: TriggerKind; entity: TriggerEntity }[] = [
  { id: "nuovo_contatto", label: "Arriva un nuovo contatto", trigger: "creazione", entity: "contact" },
  { id: "prima_appuntamento", label: "Si avvicina un appuntamento", trigger: "data_evento", entity: "appointment" },
  { id: "dopo_appuntamento", label: "È finito un appuntamento", trigger: "data_evento", entity: "appointment" },
  { id: "fase_trattativa", label: "Una trattativa passa a una fase", trigger: "cambio_fase", entity: "deal" },
  { id: "fase_acquisizione", label: "Un'acquisizione passa a una fase", trigger: "cambio_fase", entity: "acquisition" },
  { id: "stato_immobile", label: "Un immobile cambia stato", trigger: "cambio_fase", entity: "property" },
];

const doOptions: { id: ActionKind; label: string }[] = [
  { id: "whatsapp", label: "Mandiamo un WhatsApp al cliente" },
  { id: "email", label: "Mandiamo un'email al cliente" },
  { id: "task", label: "Creiamo una cosa da fare per l'agente" },
  { id: "notifica_interna", label: "Avvisiamo il titolare" },
];

const units: WaitUnit[] = ["minuti", "ore", "ore_lavorative", "giorni", "giorni_lavorativi"];

/** Crea automazione: Quando → Aspetta → Fai, con frasi da completare (mai codice) */
export function NewAutomationWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1);
  const [when, setWhen] = useState<When>("nuovo_contatto");
  const [detail, setDetail] = useState("");
  const [waitValue, setWaitValue] = useState("0");
  const [waitUnit, setWaitUnit] = useState<WaitUnit>("ore");
  const [action, setAction] = useState<ActionKind>("whatsapp");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const opt = whenOptions.find((w) => w.id === when)!;
  const details: { value: string; label: string }[] =
    when === "fase_trattativa"
      ? [...stages.map((s) => ({ value: s.id, label: s.label })), { value: "persa", label: "Persa" }]
      : when === "fase_acquisizione"
        ? [...acqPhases.map((p) => ({ value: p.id, label: p.label })), { value: "persa", label: "Persa" }]
        : when === "stato_immobile"
          ? Object.entries(statusLabel).map(([k, v]) => ({ value: k, label: v.label }))
          : when === "prima_appuntamento" || when === "dopo_appuntamento"
            ? Object.entries(appointmentKind).map(([k, v]) => ({ value: k, label: v.label }))
            : [];
  const detailValue = detail || details[0]?.value || "";
  const detailLabel = details.find((d) => d.value === detailValue)?.label ?? "";
  const wait = waitText(Number(waitValue) || 0, waitUnit);
  const sentence =
    when === "nuovo_contatto"
      ? "Quando arriva un nuovo contatto"
      : when === "prima_appuntamento"
        ? `Prima di ogni appuntamento "${detailLabel}"`
        : when === "dopo_appuntamento"
          ? `Dopo ogni appuntamento "${detailLabel}"`
          : `Quando ${when === "fase_trattativa" ? "una trattativa" : when === "fase_acquisizione" ? "un'acquisizione" : "un immobile"} passa a "${detailLabel}"`;
  const actionSentence = doOptions.find((d) => d.id === action)!.label.toLowerCase();
  const message = action === "whatsapp" || action === "email";

  async function save() {
    if (!text.trim()) return toast.error(message ? "Scrivi il messaggio" : "Scrivi il testo");
    const n: NewAutomation = {
      name: name.trim() || `${sentence}, ${wait === "subito" ? "subito" : `dopo ${wait}`}: ${actionSentence}`,
      trigger: opt.trigger,
      entity: opt.entity,
      conditions:
        when === "fase_trattativa" || when === "fase_acquisizione"
          ? { fase: detailValue }
          : when === "stato_immobile"
            ? { stato: detailValue }
            : when === "prima_appuntamento" || when === "dopo_appuntamento"
              ? { tipo: detailValue }
              : {},
      waitValue: Math.max(0, Number(waitValue) || 0),
      waitUnit,
      waitDirection: when === "prima_appuntamento" ? "prima" : "dopo",
      action,
      recipient: message ? (when === "stato_immobile" ? "proprietario" : "contatto") : action === "notifica_interna" ? "titolare" : "agente_assegnato",
      text,
      subject,
    };
    setBusy(true);
    try {
      await createAutomation(n);
      toast.success("Automazione creata e accesa", { description: n.name });
      onDone();
    } catch (err) {
      toast.error("Non creata", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-3 gap-2" aria-label="Passaggi">
        {["Quando", "Aspetta", "Fai"].map((l, i) => (
          <li
            key={l}
            aria-current={step === i + 1 ? "step" : undefined}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border text-[15px] font-semibold",
              step === i + 1 ? "border-primary bg-primary-soft text-primary-strong" : "text-muted-foreground",
            )}
          >
            {i + 1}. {l}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-3">
          {whenOptions.map((w) => (
            <button
              key={w.id}
              type="button"
              aria-pressed={when === w.id}
              onClick={() => {
                setWhen(w.id);
                setDetail("");
              }}
              className={cn("flex min-h-12 w-full items-center rounded-lg border px-4 py-2 text-left text-[17px]", when === w.id ? "border-primary bg-primary-soft font-semibold text-primary-strong" : "bg-card")}
            >
              {w.label}
            </button>
          ))}
          {details.length > 0 && (
            <Field label={when.includes("appuntamento") ? "Di che tipo" : "Quale"} htmlFor="nw-det">
              <Select id="nw-det" value={detailValue} onChange={(e) => setDetail(e.target.value)}>
                {details.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-[17px]">
            {sentence}, <strong>{when === "prima_appuntamento" ? "quanto prima" : "quanto aspettiamo"}</strong>?
          </p>
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <Input inputMode="numeric" value={waitValue} onChange={(e) => setWaitValue(e.target.value.replace(/\D/g, ""))} aria-label="Quanto" />
            <Select value={waitUnit} onChange={(e) => setWaitUnit(e.target.value as WaitUnit)} aria-label="Unità">
              {units.map((u) => (
                <option key={u} value={u}>
                  {unitLabel[u].many}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-[15px] text-muted-foreground">Metti 0 per farlo subito. I messaggi ai clienti non partono mai tra le 21 e le 8:30 né la domenica.</p>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-[17px]">
            {sentence}, {wait === "subito" ? "subito" : `${when === "prima_appuntamento" ? "" : "dopo "}${wait}${when === "prima_appuntamento" ? " prima" : ""}`}:
          </p>
          <div className="space-y-2">
            {doOptions.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={action === d.id}
                onClick={() => setAction(d.id)}
                className={cn("flex min-h-12 w-full items-center rounded-lg border px-4 py-2 text-left text-[17px]", action === d.id ? "border-primary bg-primary-soft font-semibold text-primary-strong" : "bg-card")}
              >
                {d.label}
              </button>
            ))}
          </div>
          {action === "email" && (
            <Field label="Oggetto" htmlFor="nw-sub">
              <Input id="nw-sub" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
          )}
          <Field label={message ? "Messaggio" : "Testo"} htmlFor="nw-text">
            {message ? (
              <Textarea id="nw-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ciao {{nome}}, …" />
            ) : (
              <Input id="nw-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Es. Chiama {{nome}} per un aggiornamento" />
            )}
          </Field>
          <VariableChips onInsert={(k) => setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}{{${k}}}`)} keys={["nome", "nome_agente", "nome_agenzia", "indirizzo_immobile", "data_appuntamento", "ora_appuntamento"]} />
          {text && (message ? <MessagePreview text={text} channel={action as "whatsapp" | "email"} subject={subject} /> : <p className="rounded-lg bg-muted px-4 py-3">{fill(text)}</p>)}
          <Field label="Nome dell'automazione (facoltativo)" htmlFor="nw-name">
            <Input id="nw-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lo scriviamo noi se lo lasci vuoto" />
          </Field>
          {action === "whatsapp" && (
            <p className="text-[15px] text-muted-foreground">
              Per i WhatsApp serve un modello approvato da Meta: finché non lo è, mandiamo un'email o creiamo una cosa da fare per l'agente.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {step > 1 && (
          <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft aria-hidden />
            Indietro
          </Button>
        )}
        {step < 3 ? (
          <Button size="lg" className="flex-1" onClick={() => setStep((s) => s + 1)}>
            Avanti
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={save} disabled={busy}>
            <Check aria-hidden />
            {busy ? "Creo…" : "Crea e accendi"}
          </Button>
        )}
      </div>
    </div>
  );
}
