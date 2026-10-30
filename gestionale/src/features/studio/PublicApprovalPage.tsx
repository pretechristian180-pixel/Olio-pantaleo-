import { useState } from "react";
import { useParams } from "react-router-dom";
import { Check, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/layout/Logo";
import { useQuery } from "@/hooks/useQuery";
import { decideByToken, getPublicApproval } from "@/services/studio";
import type { Outcome } from "@/types/studio";
import { finalCaption, formatSlot, platformLabel } from "./labels";
import { ReelPlayer } from "./ReelPlayer";

/**
 * Pagina aperta dal link WhatsApp: si approva senza accedere.
 * Il token è monouso e scade dopo 7 giorni (controlli sul server).
 */
export function PublicApprovalPage() {
  const { token = "" } = useParams();
  const { data, loading, error } = useQuery(() => getPublicApproval(token), [token]);
  const [mode, setMode] = useState<null | "modifiche" | "scarta">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Outcome | null>(null);
  const [fail, setFail] = useState<string | null>(null);

  async function send(outcome: Outcome) {
    if (outcome === "modifiche" && !note.trim()) return setFail("Scrivi cosa cambiare.");
    setBusy(true);
    setFail(null);
    try {
      await decideByToken(token, outcome, note);
      setDone(outcome);
    } catch (err) {
      setFail(err instanceof Error ? err.message : "Non siamo riusciti a salvare la scelta. Riprova.");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-lg items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pb-16 pt-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="mx-auto aspect-[9/16] w-full max-w-[340px]" />
          </div>
        ) : error || !data ? (
          <Message title="Link non valido" text={error ?? "Il link è scaduto o è già stato usato. Apri Mattonio per vedere il video."} />
        ) : done ? (
          <Message
            ok
            title={done === "approvato" ? "Video approvato" : done === "modifiche" ? "Richiesta inviata" : "Video scartato"}
            text={
              done === "approvato"
                ? `Sarà pubblicato ${data.publishAt ? formatSlot(data.publishAt) : "al primo orario libero"} su ${data.platforms.map((p) => platformLabel[p]).join(" e ")}. Puoi cambiare data da Mattonio.`
                : done === "modifiche"
                  ? "Chi ha preparato il video riceve la tua nota e lo sistema."
                  : "Il video non verrà pubblicato."
            }
          />
        ) : (
          <>
            <p className="text-[17px] text-muted-foreground">{data.agencyName}</p>
            <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight">Il video di {data.property.address} è pronto</h1>

            <ReelPlayer
              className="mt-6"
              photos={data.photoUrls.map((url, i) => ({ id: `f${i}`, url, scene: "soggiorno" as const }))}
              intro={data.intro}
              outro={data.outro}
              duration={data.duration}
              avatarName="titolare"
              agencyName={data.agencyName}
              agencyPhone={data.agencyPhone}
              address={data.property.address}
            />

            <section className="mt-6 rounded-lg border bg-card p-4 shadow-card">
              <p className="text-[15px] font-medium text-muted-foreground">Testo del post</p>
              <p className="mt-2 whitespace-pre-line text-[17px] leading-relaxed">{finalCaption(data.caption, data.hashtags, data.aiDisclaimer)}</p>
            </section>
            {data.publishAt && (
              <p className="mt-4 text-[17px]">
                Se approvi, esce <strong>{formatSlot(data.publishAt)}</strong> su <strong>{data.platforms.map((p) => platformLabel[p]).join(" e ")}</strong>.
              </p>
            )}

            {fail && (
              <p role="alert" className="mt-4 rounded-lg bg-destructive-soft px-4 py-3 text-destructive">
                {fail}
              </p>
            )}

            {mode === "modifiche" ? (
              <div className="mt-6 space-y-3">
                <label htmlFor="pa-note" className="block text-[15px] font-medium">
                  Cosa vuoi cambiare?
                </label>
                <Textarea id="pa-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. togli la foto del bagno" />
                <Button size="lg" className="w-full" onClick={() => send("modifiche")} disabled={busy}>
                  {busy ? "Invio…" : "Invia la richiesta"}
                </Button>
                <Button variant="ghost" size="lg" className="w-full" onClick={() => setMode(null)}>
                  Annulla
                </Button>
              </div>
            ) : mode === "scarta" ? (
              <div className="mt-6 space-y-3">
                <p className="text-[17px]">Il video non verrà pubblicato. Confermi?</p>
                <Button variant="destructive" size="lg" className="w-full" onClick={() => send("scartato")} disabled={busy}>
                  {busy ? "Un momento…" : "Sì, scarta il video"}
                </Button>
                <Button variant="ghost" size="lg" className="w-full" onClick={() => setMode(null)}>
                  Annulla
                </Button>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <Button size="lg" className="w-full" onClick={() => send("approvato")} disabled={busy}>
                  <Check aria-hidden />
                  {busy ? "Un momento…" : "Approva e programma"}
                </Button>
                <div className="grid gap-3 min-[420px]:grid-cols-2">
                  <Button variant="outline" size="lg" onClick={() => setMode("modifiche")}>
                    <Pencil aria-hidden />
                    Chiedi modifiche
                  </Button>
                  <Button variant="outline" size="lg" className="text-destructive" onClick={() => setMode("scarta")}>
                    <Trash2 aria-hidden />
                    Scarta
                  </Button>
                </div>
              </div>
            )}
            <p className="mt-6 text-center text-sm text-muted-foreground">Questo link vale una sola volta e scade dopo 7 giorni.</p>
          </>
        )}
      </main>
    </div>
  );
}

function Message({ title, text, ok }: { title: string; text: string; ok?: boolean }) {
  return (
    <div className="mt-10 text-center">
      {ok && <CheckCircle2 className="mx-auto size-16 text-success" aria-hidden />}
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-[17px] text-muted-foreground">{text}</p>
    </div>
  );
}
