import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/layout/Logo";
import { useQuery } from "@/hooks/useQuery";
import { cn } from "@/lib/utils";
import { getQuestionnaire, sendQuestionnaire, unsubscribe } from "@/services/automations";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-lg items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}

function Done({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-10 text-center">
      <CheckCircle2 className="mx-auto size-16 text-success" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-[17px] text-muted-foreground">{text}</p>
    </div>
  );
}

function Pick<T extends string>({ label, value, options, onChange }: { label: string; value: T | ""; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[17px] font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={cn("h-12 rounded-full border px-4 text-[16px] font-medium", value === k ? "border-primary bg-primary text-white" : "bg-card")}
          >
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Questionario dopo la visita, aperto dal link WhatsApp: 30 secondi, nessun login */
export function QuestionnairePage() {
  const { token = "" } = useParams();
  const { data, loading, error } = useQuery(() => getQuestionnaire(token), [token]);
  const [f, setF] = useState({ voto: 0, piaciuto: "", non_piaciuto: "", prezzo: "" as "" | "basso" | "giusto" | "alto", offerta: "", intenzione: "" as string });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [fail, setFail] = useState<string | null>(null);

  async function send() {
    if (!f.intenzione) return setFail("Dicci come vorresti procedere.");
    setBusy(true);
    setFail(null);
    try {
      await sendQuestionnaire(token, f);
      setSent(true);
    } catch (e) {
      setFail(e instanceof Error ? e.message : "Non siamo riusciti a inviare. Riprova.");
    }
    setBusy(false);
  }

  return (
    <Shell>
      {loading ? (
        <Skeleton className="h-96" />
      ) : error || !data ? (
        <Done title="Link non valido" text={error ?? "Il questionario non è disponibile."} />
      ) : sent || data.gia_compilato ? (
        <Done title="Grazie!" text={`Le tue risposte sono arrivate a ${data.agenzia}. Ti ricontattiamo presto.`} />
      ) : data.scaduto ? (
        <Done title="Questionario chiuso" text={`Per qualsiasi cosa scrivi pure a ${data.agenzia}.`} />
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-[17px] text-muted-foreground">{data.agenzia}</p>
            <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight">
              {data.nome ? `${data.nome}, com'è` : "Com'è"} andata la visita{data.indirizzo ? ` in ${data.indirizzo}` : ""}?
            </h1>
          </div>
          <fieldset>
            <legend className="mb-2 text-[17px] font-medium">Il tuo voto</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`${n} su 5`} aria-pressed={f.voto === n} onClick={() => setF((x) => ({ ...x, voto: n }))} className="flex size-12 items-center justify-center">
                  <Star className={cn("size-9", n <= f.voto ? "fill-primary text-primary" : "text-border")} aria-hidden />
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Cosa ti è piaciuto?" htmlFor="q-like">
            <Input id="q-like" value={f.piaciuto} onChange={(e) => setF((x) => ({ ...x, piaciuto: e.target.value }))} />
          </Field>
          <Field label="Cosa non ti ha convinto?" htmlFor="q-dislike">
            <Input id="q-dislike" value={f.non_piaciuto} onChange={(e) => setF((x) => ({ ...x, non_piaciuto: e.target.value }))} />
          </Field>
          <Pick label="Il prezzo ti sembra" value={f.prezzo} options={[["basso", "Conveniente"], ["giusto", "Giusto"], ["alto", "Alto"]]} onChange={(v) => setF((x) => ({ ...x, prezzo: v }))} />
          <Pick
            label="Come vorresti procedere?"
            value={f.intenzione}
            options={[["proposta", "Vorrei fare una proposta"], ["ci_pensa", "Ci penso"], ["altro_immobile", "Vorrei vedere altro"], ["non_interessato", "Non mi interessa"]]}
            onChange={(v) => setF((x) => ({ ...x, intenzione: v }))}
          />
          {f.intenzione === "proposta" && (
            <Field label="Quanto vorresti offrire? (facoltativo)" htmlFor="q-offer">
              <Input id="q-offer" inputMode="numeric" value={f.offerta} onChange={(e) => setF((x) => ({ ...x, offerta: e.target.value }))} placeholder="€" />
            </Field>
          )}
          {fail && (
            <p role="alert" className="rounded-lg bg-destructive-soft px-4 py-3 text-destructive">
              {fail}
            </p>
          )}
          <Button size="lg" className="w-full" onClick={send} disabled={busy}>
            {busy ? "Invio…" : "Invia"}
          </Button>
        </div>
      )}
    </Shell>
  );
}

/** Disiscrizione dalle email automatiche (link in fondo a ogni email) */
export function UnsubscribePage() {
  const { token = "" } = useParams();
  const [state, setState] = useState<{ ok?: boolean; agenzia?: string; error?: string } | null>(null);
  useEffect(() => {
    unsubscribe(token)
      .then((r) => setState(r))
      .catch((e) => setState({ error: e instanceof Error ? e.message : "Link non valido." }));
  }, [token]);
  return (
    <Shell>
      {!state ? (
        <Skeleton className="h-40" />
      ) : state.ok ? (
        <Done title="Fatto" text={`Non riceverai più email automatiche${state.agenzia ? ` da ${state.agenzia}` : ""}.`} />
      ) : (
        <Done title="Link non valido" text={state.error ?? ""} />
      )}
    </Shell>
  );
}
