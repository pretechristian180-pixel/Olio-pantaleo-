import { useRef, useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { deleteAutomation, updateAutomation } from "@/services/automations";
import type { Automation, WaitUnit } from "@/types/automations";
import { fill, metaText, templateState, unitLabel, variables } from "./labels";

/** Variabili da toccare per inserirle nel testo */
export function VariableChips({ onInsert, keys }: { onInsert: (k: string) => void; keys?: string[] }) {
  const list = variables.filter((v) => !keys || keys.includes(v.key));
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Inserisci un dato">
      {list.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onInsert(v.key)}
          className="h-9 rounded-full border bg-card px-3 text-sm text-foreground/80 hover:border-primary/40 hover:text-primary-strong"
        >
          + {v.label}
        </button>
      ))}
    </div>
  );
}

/** Anteprima del messaggio come lo vedrà il cliente */
export function MessagePreview({ text, channel, subject }: { text: string; channel: "whatsapp" | "email"; subject?: string }) {
  if (channel === "email")
    return (
      <div className="rounded-lg border bg-card p-4">
        {subject && <p className="mb-2 border-b pb-2 font-semibold">{fill(subject)}</p>}
        <p className="whitespace-pre-line text-[15px] leading-relaxed">{fill(text)}</p>
      </div>
    );
  return (
    <div className="rounded-xl bg-[#E9E4D8] p-3">
      <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#D9FDD3] px-3 py-2 text-[15px] leading-relaxed text-[#111B21] shadow-sm">
        <p className="whitespace-pre-line">{fill(text)}</p>
        <p className="mt-1 text-right text-[11px] text-[#667781]">10:15</p>
      </div>
    </div>
  );
}

const editableUnits: WaitUnit[] = ["minuti", "ore", "ore_lavorative", "giorni", "giorni_lavorativi"];

/** Modifica di una ricetta: solo tempi e testi, con anteprima */
export function AutomationEditor({ automation: a, onDone }: { automation: Automation; onDone: () => void }) {
  const message = (a.action === "whatsapp" || a.action === "email") && !!a.template;
  const [text, setText] = useState(a.template?.text ?? "");
  const [subject, setSubject] = useState(a.template?.subject ?? "");
  const [title, setTitle] = useState(a.content.titolo ?? "");
  const [waitValue, setWaitValue] = useState(String(a.waitValue));
  const [waitUnit, setWaitUnit] = useState<WaitUnit>(a.waitUnit);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fixedDays = a.trigger === "periodico" || a.trigger === "inattivita" || a.trigger === "data_fissa";
  const noWait = a.trigger === "data_fissa" || (a.trigger === "data_campo" && a.entity === "contact");

  function insert(k: string) {
    const tag = `{{${k}}}`;
    const el = area.current;
    if (message) {
      const pos = el?.selectionStart ?? text.length;
      setText(text.slice(0, pos) + tag + text.slice(pos));
    } else setTitle((t) => `${t}${t.endsWith(" ") || !t ? "" : " "}${tag}`);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (message && !text.trim()) return toast.error("Il messaggio non può essere vuoto");
    if (!message && !title.trim()) return toast.error("Scrivi il testo");
    setBusy(true);
    try {
      await updateAutomation(a, {
        waitValue: Math.max(0, Number(waitValue) || 0),
        waitUnit: fixedDays ? "giorni" : waitUnit,
        ...(message ? { text, subject: a.action === "email" ? subject : undefined } : { title }),
      });
      toast.success("Automazione salvata", {
        description: message && a.action === "whatsapp" && a.template?.waState === "approvato" && text !== a.template.text ? "Il testo è cambiato: il modello va riapprovato da Meta." : undefined,
      });
      onDone();
    } catch (err) {
      toast.error("Non salvata", { description: friendlyError(err) });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {!noWait && (
        <fieldset>
          <legend className="mb-2 text-[15px] font-medium">
            {fixedDays ? "Ogni quanti giorni" : a.waitDirection === "prima" ? "Quanto prima" : "Quanto aspettare"}
          </legend>
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <Input inputMode="numeric" value={waitValue} onChange={(e) => setWaitValue(e.target.value.replace(/\D/g, ""))} aria-label="Quanto" />
            {fixedDays ? (
              <p className="flex h-12 items-center text-[17px]">giorni</p>
            ) : (
              <Select value={waitUnit} onChange={(e) => setWaitUnit(e.target.value as WaitUnit)} aria-label="Unità">
                {editableUnits.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel[u].many}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </fieldset>
      )}

      {message ? (
        <>
          {a.action === "email" && (
            <Field label="Oggetto dell'email" htmlFor="ae-sub">
              <Input id="ae-sub" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
          )}
          <Field label="Testo del messaggio" htmlFor="ae-text">
            <Textarea id="ae-text" ref={area} value={text} onChange={(e) => setText(e.target.value)} className="min-h-36" />
          </Field>
          <VariableChips onInsert={insert} />
          <div>
            <p className="mb-2 text-[15px] font-medium">Come lo vedrà il cliente</p>
            <MessagePreview text={text} channel={a.action as "whatsapp" | "email"} subject={subject} />
          </div>
          {a.action === "whatsapp" && a.template && <MetaBox name={a.template.waName} state={a.template.waState} text={text} />}
        </>
      ) : (
        <>
          <Field label={a.action === "notifica_interna" ? "Testo dell'avviso" : "Cosa da fare"} htmlFor="ae-title">
            <Input id="ae-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <VariableChips onInsert={insert} keys={["nome", "indirizzo_immobile", "data_appuntamento"]} />
          <p className="rounded-lg bg-muted px-4 py-3 text-[15px]">
            Anteprima: <strong>{fill(title)}</strong>
          </p>
        </>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        <Check aria-hidden />
        {busy ? "Salvataggio…" : "Salva"}
      </Button>
      {!a.recipe && (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-destructive"
          onClick={async () => {
            if (!window.confirm("Eliminare questa automazione?")) return;
            try {
              await deleteAutomation(a.id);
              toast.success("Automazione eliminata");
              onDone();
            } catch (err) {
              toast.error("Non eliminata", { description: friendlyError(err) });
            }
          }}
        >
          <Trash2 aria-hidden />
          Elimina automazione
        </Button>
      )}
    </form>
  );
}

/** Stato del modello su Meta e testo da registrare (con {{1}}, {{2}}…) */
function MetaBox({ name, state, text }: { name: string | null; state: keyof typeof templateState; text: string }) {
  const meta = metaText(text);
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">Modello WhatsApp</p>
        <Badge tone={templateState[state].tone}>{templateState[state].label}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        WhatsApp permette di scrivere per primi solo con un modello approvato da Meta. Finché non è approvato, mandiamo un'email o creiamo una
        cosa da fare per l'agente.
      </p>
      {state !== "approvato" && (
        <>
          <p className="text-sm">
            Nome del modello: <code className="rounded bg-muted px-1.5 py-0.5">{name}</code> · lingua: italiano · categoria: utility
          </p>
          <p className="whitespace-pre-line rounded bg-muted px-3 py-2 text-sm">{meta}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(meta).then(() => toast.success("Testo copiato")).catch(() => toast.error("Copia non riuscita"))}
          >
            <Copy aria-hidden />
            Copia il testo per Meta
          </Button>
        </>
      )}
    </div>
  );
}
