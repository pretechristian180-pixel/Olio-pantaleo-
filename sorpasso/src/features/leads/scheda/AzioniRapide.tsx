import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarPlus, FileText, Mail, MessageCircle, Phone, ThumbsDown, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/shared/States";
import { useTemplates } from "@/lib/queries";
import { mostraErrore } from "@/lib/errors";
import { linkTelefono } from "@/lib/messaggi";
import type { LeadView } from "@/types/db";
import AppuntamentoDialog from "@/features/agenda/AppuntamentoDialog";
import { useAggiungiAttivita } from "../api";
import { ChiudiVenditaDialog, PersoDialog } from "../dialogs";
import { compilaTemplate, useInviaMessaggio, useVariabili } from "./messaggi";

/** I pulsanti che servono a vendere, grandi e raggiungibili col pollice. */
export function AzioniRapide({ lead }: { lead: LeadView }) {
  const navigate = useNavigate();
  const [esitoChiamata, setEsitoChiamata] = useState(false);
  const [messaggio, setMessaggio] = useState<"whatsapp" | "email" | null>(null);
  const [testDrive, setTestDrive] = useState(false);
  const [perso, setPerso] = useState(false);
  const [vinto, setVinto] = useState(false);
  const chiuso = lead.stato === "vinto" || lead.stato === "perso";

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {lead.contatto_telefono ? (
          <Button asChild variant="accent" className="h-auto flex-col gap-1 py-3" onClick={() => setEsitoChiamata(true)}>
            <a href={linkTelefono(lead.contatto_telefono)}>
              <Phone aria-hidden /> Chiama
            </a>
          </Button>
        ) : (
          <Button variant="outline" className="h-auto flex-col gap-1 py-3" disabled>
            <Phone aria-hidden /> Chiama
          </Button>
        )}
        <Button
          variant="outline"
          className="h-auto flex-col gap-1 py-3 text-[#128C7E]"
          disabled={!lead.contatto_telefono}
          onClick={() => setMessaggio("whatsapp")}
        >
          <MessageCircle aria-hidden /> WhatsApp
        </Button>
        <Button
          variant="outline"
          className="h-auto flex-col gap-1 py-3"
          disabled={!lead.contatto_email}
          title={lead.contatto_email ? undefined : "Il cliente non ha un'email"}
          onClick={() => setMessaggio("email")}
        >
          <Mail aria-hidden /> Email
        </Button>
        {!chiuso && (
          <>
            <Button variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => setTestDrive(true)}>
              <CalendarPlus aria-hidden /> Test drive
            </Button>
            <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
              <Link to={`/lead/${lead.id}/preventivo`}>
                <FileText aria-hidden /> Preventivo
              </Link>
            </Button>
            <Button variant="success" className="h-auto flex-col gap-1 py-3" onClick={() => setVinto(true)}>
              <Trophy aria-hidden /> Vendita
            </Button>
          </>
        )}
      </div>
      {!chiuso && (
        <button type="button" onClick={() => setPerso(true)} className="mt-3 inline-flex h-10 items-center gap-1.5 text-[15px] font-medium text-muted-foreground hover:text-destructive">
          <ThumbsDown className="size-4" aria-hidden /> Segna come perso
        </button>
      )}

      <EsitoChiamataDialog leadId={lead.id} open={esitoChiamata} onOpenChange={setEsitoChiamata} />
      {messaggio && <MessaggioDialog lead={lead} canale={messaggio} onClose={() => setMessaggio(null)} />}
      <AppuntamentoDialog
        open={testDrive}
        onOpenChange={setTestDrive}
        iniziale={{
          tipo: "test_drive",
          lead_id: lead.id,
          contact_id: lead.contact_id,
          vehicle_id: lead.vehicle_id,
          assegnato_a: lead.assegnato_a,
          cliente: `${lead.contatto_nome} ${lead.contatto_cognome}`.trim(),
        }}
      />
      <PersoDialog leadId={lead.id} open={perso} onOpenChange={setPerso} />
      <ChiudiVenditaDialog
        leadId={lead.id}
        vehicleId={lead.vehicle_id}
        prezzoProposto={lead.veicolo_prezzo}
        open={vinto}
        onOpenChange={setVinto}
        onFatto={(id) => navigate(`/pratiche/${id}`)}
      />
    </>
  );
}

const ESITI = ["Interessato, da richiamare", "Fissato appuntamento", "Non risponde", "Numero errato", "Non più interessato"];

/** Dopo "Chiama": registra com'è andata (facoltativo ma veloce). */
function EsitoChiamataDialog({ leadId, open, onOpenChange }: { leadId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const aggiungi = useAggiungiAttivita();
  const [esito, setEsito] = useState(ESITI[0]!);
  const [nota, setNota] = useState("");

  async function salva() {
    try {
      await aggiungi.mutateAsync({ lead_id: leadId, tipo: "chiamata", contenuto: nota.trim() ? `${esito} – ${nota.trim()}` : esito });
      toast.success("Chiamata registrata");
      setNota("");
      onOpenChange(false);
    } catch (e) {
      mostraErrore(e);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Com'è andata la chiamata?" description="La registriamo nello storico del cliente.">
        <div className="space-y-4">
          <div className="grid gap-2">
            {ESITI.map((e) => (
              <label key={e} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="radio" name="esito" className="size-5 accent-[var(--accent)]" checked={esito === e} onChange={() => setEsito(e)} />
                {e}
              </label>
            ))}
          </div>
          <Field label="Note (facoltative)" htmlFor="esito-nota">
            <Textarea id="esito-nota" className="min-h-20" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} />
          </Field>
          <Button variant="accent" className="w-full" onClick={salva} disabled={aggiungi.isPending}>
            {aggiungi.isPending && <Spinner />}
            Registra chiamata
          </Button>
          <p className="text-center text-sm text-muted-foreground">Ricorda di aggiornare la prossima azione.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** WhatsApp o email da template, modificabile prima dell'invio. */
function MessaggioDialog({ lead, canale, onClose }: { lead: LeadView; canale: "whatsapp" | "email"; onClose: () => void }) {
  const templates = useTemplates(canale);
  const variabili = useVariabili(lead);
  const invia = useInviaMessaggio(lead);
  const [templateId, setTemplateId] = useState("");
  const [oggetto, setOggetto] = useState("");
  const [testo, setTesto] = useState("");
  const [invio, setInvio] = useState(false);

  function scegli(id: string) {
    setTemplateId(id);
    const t = templates.data?.find((x) => x.id === id);
    if (!t) return;
    setTesto(compilaTemplate(t.testo, variabili));
    setOggetto(t.oggetto ? compilaTemplate(t.oggetto, variabili) : "");
  }

  async function onInvia() {
    if (!testo.trim()) return toast.error("Scrivi il messaggio");
    setInvio(true);
    try {
      await invia(canale, testo.trim(), oggetto.trim() || undefined);
      toast.success(canale === "whatsapp" ? "WhatsApp aperto e registrato nello storico" : "Email preparata e registrata nello storico");
      onClose();
    } catch (e) {
      mostraErrore(e);
    } finally {
      setInvio(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={canale === "whatsapp" ? "Messaggio WhatsApp" : "Email"} description="Scegli un modello e modificalo come vuoi.">
        <div className="space-y-4">
          <Field label="Modello" htmlFor="msg-tpl">
            <Select id="msg-tpl" value={templateId} onChange={(e) => scegli(e.target.value)}>
              <option value="">Messaggio libero</option>
              {templates.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Select>
          </Field>
          {canale === "email" && (
            <Field label="Oggetto" htmlFor="msg-ogg">
              <Input id="msg-ogg" value={oggetto} onChange={(e) => setOggetto(e.target.value)} />
            </Field>
          )}
          <Field label="Testo" htmlFor="msg-testo">
            <Textarea id="msg-testo" className="min-h-40" value={testo} onChange={(e) => setTesto(e.target.value)} />
          </Field>
          <Button variant="accent" className="w-full" onClick={onInvia} disabled={invio}>
            {invio && <Spinner />}
            {canale === "whatsapp" ? "Apri WhatsApp" : "Apri email"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
