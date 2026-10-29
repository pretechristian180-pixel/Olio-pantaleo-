import { useState } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/shared/States";
import { chiediAI } from "@/lib/ai";
import { mostraErrore } from "@/lib/errors";
import { separaOggetto } from "@/lib/messaggi";
import type { LeadView } from "@/types/db";
import { useInviaMessaggio } from "./messaggi";

/** Riassunto del lead e bozza di risposta generati dall'AI. Il venditore rivede sempre prima di inviare. */
export function PannelloAI({ lead, sola_lettura }: { lead: LeadView; sola_lettura: boolean }) {
  const invia = useInviaMessaggio(lead);
  const [riassunto, setRiassunto] = useState<string | null>(null);
  const [caricaRiassunto, setCaricaRiassunto] = useState(false);
  const [canale, setCanale] = useState<"whatsapp" | "email" | null>(null);
  const [bozza, setBozza] = useState("");
  const [oggetto, setOggetto] = useState("");
  const [caricaBozza, setCaricaBozza] = useState(false);
  const [invio, setInvio] = useState(false);

  async function riassumi() {
    setCaricaRiassunto(true);
    try {
      setRiassunto(await chiediAI({ azione: "riassunto_lead", lead_id: lead.id }));
    } catch (e) {
      mostraErrore(e);
    } finally {
      setCaricaRiassunto(false);
    }
  }

  async function suggerisci(c: "whatsapp" | "email") {
    setCanale(c);
    setCaricaBozza(true);
    try {
      const testo = await chiediAI({ azione: "suggerisci_risposta", lead_id: lead.id, canale: c });
      if (c === "email") {
        const s = separaOggetto(testo);
        setOggetto(s.oggetto ?? "");
        setBozza(s.corpo);
      } else {
        setBozza(testo);
        setOggetto("");
      }
    } catch (e) {
      mostraErrore(e);
      setCanale(null);
    } finally {
      setCaricaBozza(false);
    }
  }

  async function onInvia() {
    if (!canale || !bozza.trim()) return;
    setInvio(true);
    try {
      await invia(canale, bozza.trim(), oggetto.trim() || undefined);
      toast.success("Messaggio aperto e registrato nello storico");
      setCanale(null);
      setBozza("");
    } catch (e) {
      mostraErrore(e);
    } finally {
      setInvio(false);
    }
  }

  return (
    <section className="rounded-lg border border-accent/25 bg-gradient-to-br from-accent-soft/70 to-card p-4 shadow-card sm:p-5" aria-label="Assistente AI">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold">
        <Sparkles className="size-5 text-accent" aria-hidden /> Assistente AI
      </h2>

      <div className="mt-3">
        {caricaRiassunto ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-full bg-white" />
            <Skeleton className="h-4 w-5/6 bg-white" />
            <Skeleton className="h-4 w-4/6 bg-white" />
          </div>
        ) : riassunto ? (
          <div className="whitespace-pre-line rounded-lg bg-card p-3 text-[15px] leading-relaxed">{riassunto}</div>
        ) : (
          <p className="text-[15px] text-muted-foreground">In tre righe: cosa vuole il cliente e qual è la prossima mossa.</p>
        )}
        <Button variant="accent-soft" size="sm" className="mt-3" onClick={riassumi} disabled={caricaRiassunto}>
          {caricaRiassunto ? <Spinner className="size-4 animate-spin" /> : riassunto ? <RefreshCw className="size-4" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {riassunto ? "Aggiorna riassunto" : "Riassunto lead"}
        </Button>
      </div>

      {!sola_lettura && (
        <div className="mt-5 border-t border-accent/15 pt-4">
          <p className="mb-2 font-medium">Suggerisci risposta</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => suggerisci("whatsapp")} disabled={caricaBozza || !lead.contatto_telefono}>
              <MessageCircle className="size-4" aria-hidden /> WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={() => suggerisci("email")} disabled={caricaBozza || !lead.contatto_email}>
              <Mail className="size-4" aria-hidden /> Email
            </Button>
          </div>

          {canale && (
            <div className="mt-3 space-y-2">
              {caricaBozza ? (
                <div className="flex items-center gap-2 rounded-lg bg-card p-4 text-[15px] text-muted-foreground" aria-busy="true">
                  <Spinner className="size-4 animate-spin" /> Sto scrivendo una bozza basata sullo storico…
                </div>
              ) : (
                <>
                  {canale === "email" && <Input aria-label="Oggetto" value={oggetto} onChange={(e) => setOggetto(e.target.value)} placeholder="Oggetto" />}
                  <Textarea aria-label="Bozza" className="min-h-36 bg-card" value={bozza} onChange={(e) => setBozza(e.target.value)} />
                  <p className="text-sm text-muted-foreground">Rileggi e modifica: l'AI può sbagliare.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="accent" size="sm" onClick={onInvia} disabled={invio || !bozza.trim()}>
                      {invio && <Spinner className="size-4 animate-spin" />}
                      {canale === "whatsapp" ? "Invia su WhatsApp" : "Apri email"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCanale(null)}>
                      Scarta
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
