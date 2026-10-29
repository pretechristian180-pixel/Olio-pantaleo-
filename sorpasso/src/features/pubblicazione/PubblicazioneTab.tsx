import { useEffect, useState } from "react";
import { z } from "zod";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, Info, MessageCircle, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Switch, Textarea } from "@/components/ui/input";
import { Section } from "@/components/shared/Section";
import { Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { generaDescrizioni } from "@/lib/ai";
import { mostraErrore } from "@/lib/errors";
import type { VehicleView } from "@/types/db";
import { copia, linkCondividiWhatsApp, linkPubblico, useAggiornaPubblicazione } from "./api";

const MAX_COMPLETA = 5000;
const MAX_BREVE = 600;

const schemaDescrizioni = z.object({
  descrizione: z.string().trim().max(MAX_COMPLETA, `La descrizione completa può avere al massimo ${MAX_COMPLETA} caratteri`),
  descrizione_breve: z.string().trim().max(MAX_BREVE, `La versione breve può avere al massimo ${MAX_BREVE} caratteri`),
});

async function copiaConAvviso(testo: string, cosa: string) {
  if (!testo.trim()) return toast.error(`${cosa}: niente da copiare`);
  if (await copia(testo)) toast.success(`${cosa} copiato`);
  else toast.error("Non riesco a copiare: seleziona il testo e copialo a mano.");
}

/**
 * Tab "Pubblicazione" della scheda veicolo:
 * descrizioni (AI + modifica), pagina pubblica con link e QR, scheda tecnica PDF, condivisione WhatsApp.
 */
export default function PubblicazioneTab({ veicolo }: { veicolo: VehicleView }) {
  return (
    <div className="space-y-6">
      <Descrizioni veicolo={veicolo} />
      <PaginaPubblica veicolo={veicolo} />
      <SchedaPdf veicolo={veicolo} />
    </div>
  );
}

/* ---------- Descrizioni ---------- */

function Descrizioni({ veicolo }: { veicolo: VehicleView }) {
  const { isManager } = useSessione();
  const aggiorna = useAggiornaPubblicazione();
  const [completa, setCompleta] = useState(veicolo.descrizione ?? "");
  const [breve, setBreve] = useState(veicolo.descrizione_breve ?? "");
  const [generazione, setGenerazione] = useState(false);

  // Riallinea quando cambiano i dati salvati (es. dopo il salvataggio o una modifica di un collega)
  useEffect(() => setCompleta(veicolo.descrizione ?? ""), [veicolo.descrizione]);
  useEffect(() => setBreve(veicolo.descrizione_breve ?? ""), [veicolo.descrizione_breve]);

  const modificato = completa !== (veicolo.descrizione ?? "") || breve !== (veicolo.descrizione_breve ?? "");

  async function genera() {
    if ((completa.trim() || breve.trim()) && !window.confirm("Le descrizioni attuali verranno sostituite dalla proposta dell'AI. Continuare?")) return;
    setGenerazione(true);
    try {
      const r = await generaDescrizioni(veicolo.id);
      setCompleta(r.completa);
      setBreve(r.breve);
      toast.success("Proposta pronta", { description: isManager ? "Rileggila, modificala se serve e salva." : "Rileggila e copiala dove ti serve." });
    } catch (e) {
      mostraErrore(e, "L'AI non è riuscita a scrivere la descrizione. Riprova.");
    } finally {
      setGenerazione(false);
    }
  }

  async function salva() {
    const v = schemaDescrizioni.safeParse({ descrizione: completa, descrizione_breve: breve });
    if (!v.success) return toast.error(v.error.issues[0]!.message);
    try {
      await aggiorna.mutateAsync({
        id: veicolo.id,
        descrizione: v.data.descrizione || null,
        descrizione_breve: v.data.descrizione_breve || null,
      });
      toast.success("Descrizioni salvate");
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare le descrizioni.");
    }
  }

  return (
    <Section
      title="Descrizioni dell'annuncio"
      action={
        <Button variant="accent-soft" size="sm" onClick={genera} disabled={generazione}>
          {generazione ? <Spinner className="size-4 animate-spin" /> : <Sparkles className="size-4" aria-hidden />}
          {generazione ? "Sto scrivendo…" : "Genera con AI"}
        </Button>
      }
    >
      <p className="mb-5 flex items-start gap-2 rounded-lg bg-accent-soft/60 px-3 py-2.5 text-sm text-primary">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        L'AI usa solo i dati della scheda tecnica (niente note interne, difetti o costi). Controlla sempre il testo prima di pubblicarlo.
      </p>
      <div className="space-y-5">
        <CampoDescrizione
          id="pub-completa"
          label="Versione completa"
          hint="Per AutoScout24, Subito e il sito."
          valore={completa}
          onChange={setCompleta}
          max={MAX_COMPLETA}
          righe="min-h-56"
          generazione={generazione}
          sola={!isManager}
        />
        <CampoDescrizione
          id="pub-breve"
          label="Versione breve"
          hint="Per social e WhatsApp."
          valore={breve}
          onChange={setBreve}
          max={MAX_BREVE}
          righe="min-h-28"
          generazione={generazione}
          sola={!isManager}
        />
        {isManager ? (
          <div className="flex justify-end">
            <Button onClick={salva} disabled={!modificato || aggiorna.isPending}>
              {aggiorna.isPending ? <Spinner /> : <Save aria-hidden />}
              Salva descrizioni
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Solo titolare e responsabile vendite possono salvare le descrizioni. Puoi generarle e copiarle.</p>
        )}
      </div>
    </Section>
  );
}

function CampoDescrizione({
  id,
  label,
  hint,
  valore,
  onChange,
  max,
  righe,
  generazione,
  sola,
}: {
  id: string;
  label: string;
  hint: string;
  valore: string;
  onChange: (v: string) => void;
  max: number;
  righe: string;
  generazione: boolean;
  sola: boolean;
}) {
  const troppo = valore.length > max;
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <Label htmlFor={id} className="mb-0">
          {label}
          <span className="block text-sm font-normal text-muted-foreground">{hint}</span>
        </Label>
        <Button type="button" variant="outline" size="xs" onClick={() => void copiaConAvviso(valore, label)}>
          <Copy aria-hidden />
          Copia
        </Button>
      </div>
      <Textarea
        id={id}
        className={righe}
        value={valore}
        onChange={(e) => onChange(e.target.value)}
        readOnly={sola}
        disabled={generazione}
        aria-invalid={troppo}
        placeholder="Nessuna descrizione. Premi «Genera con AI» per una proposta in pochi secondi."
      />
      <p className={`mt-1 text-right text-sm tabular-nums ${troppo ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
        {valore.length.toLocaleString("it-IT")} / {max.toLocaleString("it-IT")} caratteri
      </p>
    </div>
  );
}

/* ---------- Pagina pubblica ---------- */

function PaginaPubblica({ veicolo }: { veicolo: VehicleView }) {
  const { isManager } = useSessione();
  const aggiorna = useAggiornaPubblicazione();
  const link = linkPubblico(veicolo.token_pubblico);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    QRCode.toDataURL(link, { margin: 1, width: 280, color: { dark: "#0f2147", light: "#ffffff" } })
      .then((u) => attivo && setQr(u))
      .catch(() => attivo && setQr(null));
    return () => {
      attivo = false;
    };
  }, [link]);

  async function cambia(pubblica: boolean) {
    try {
      await aggiorna.mutateAsync({ id: veicolo.id, pubblica });
      toast.success(pubblica ? "Pagina pubblica attiva" : "Pagina pubblica disattivata", {
        description: pubblica ? undefined : "Chi ha il link vedrà «scheda non disponibile».",
      });
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a cambiare la pubblicazione.");
    }
  }

  const testoWhatsApp = `${veicolo.descrizione_breve?.trim() || `${veicolo.marca} ${veicolo.modello}${veicolo.versione ? ` ${veicolo.versione}` : ""}`}\n\nFoto e dettagli: ${link}`;

  return (
    <Section title="Pagina pubblica">
      <div className="space-y-4">
        {isManager ? (
          <Switch
            id="pub-attiva"
            checked={veicolo.pubblica}
            onChange={(v) => void cambia(v)}
            label="Pagina pubblica attiva"
            description="Foto, dati e prezzo, senza informazioni interne. I clienti possono scriverti o prenotare un test drive."
          />
        ) : (
          <p className="text-[15px]">
            Stato: <span className="font-semibold">{veicolo.pubblica ? "pubblicata" : "non pubblicata"}</span>
          </p>
        )}
        {veicolo.stato === "venduto" && veicolo.pubblica && (
          <p className="rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">L'auto è venduta: la pagina lo indica e non accetta nuove richieste.</p>
        )}

        <div className={veicolo.pubblica ? "" : "pointer-events-none opacity-50"} aria-disabled={!veicolo.pubblica}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {qr && (
              <img src={qr} alt="Codice QR della pagina pubblica" className="size-36 shrink-0 self-center rounded-lg border bg-white p-1.5 sm:self-start" />
            )}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/60 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{link}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button variant="outline" onClick={() => void copiaConAvviso(link, "Link")}>
                  <Copy aria-hidden />
                  Copia link
                </Button>
                <Button variant="outline" asChild>
                  <a href={link} target="_blank" rel="noopener">
                    <ExternalLink aria-hidden />
                    Apri
                  </a>
                </Button>
                <Button variant="success" asChild>
                  <a href={linkCondividiWhatsApp(testoWhatsApp)} target="_blank" rel="noopener">
                    <MessageCircle aria-hidden />
                    WhatsApp
                  </a>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Il link non si può indovinare. Le richieste arrivate da qui diventano lead collegati a quest'auto.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ---------- Scheda tecnica PDF ---------- */

function SchedaPdf({ veicolo }: { veicolo: VehicleView }) {
  const { organizzazione } = useSessione();
  const [inCorso, setInCorso] = useState(false);
  const link = linkPubblico(veicolo.token_pubblico);

  async function scarica() {
    setInCorso(true);
    try {
      const { generaSchedaPdf } = await import("./pdfScheda");
      const blob = await generaSchedaPdf(veicolo, organizzazione, link);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scheda-${veicolo.marca}-${veicolo.modello}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success("Scheda scaricata");
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a creare la scheda PDF.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <Section title="Scheda tecnica PDF">
      <p className="mb-4 text-[15px] text-muted-foreground">
        Una pagina con logo, foto principale, dati, optional, prezzo e codice QR verso la pagina pubblica. Da stampare per il cruscotto o da inviare
        al cliente.
      </p>
      {!organizzazione.logo_url && (
        <p className="mb-4 text-sm text-muted-foreground">Suggerimento: carica il logo in Impostazioni → Azienda per vederlo sulla scheda.</p>
      )}
      {!veicolo.pubblica && (
        <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
          La pagina pubblica è disattivata: il codice QR sulla scheda porterà a «scheda non disponibile».
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={scarica} disabled={inCorso}>
          {inCorso ? <Spinner /> : <Download aria-hidden />}
          {inCorso ? "Preparo la scheda…" : "Scarica scheda"}
        </Button>
        <Button variant="success" asChild>
          <a
            href={linkCondividiWhatsApp(`${veicolo.marca} ${veicolo.modello}: scheda completa con foto e prezzo\n${link}`)}
            target="_blank"
            rel="noopener"
            aria-disabled={!veicolo.pubblica}
            className={veicolo.pubblica ? "" : "pointer-events-none opacity-50"}
          >
            <MessageCircle aria-hidden />
            Invia su WhatsApp
          </a>
        </Button>
      </div>
    </Section>
  );
}
