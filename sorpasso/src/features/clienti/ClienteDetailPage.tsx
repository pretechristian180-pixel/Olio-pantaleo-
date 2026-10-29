import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight, Mail, MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import { BackLink } from "@/components/shared/BackLink";
import { Avatar } from "@/components/shared/Avatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { InfoRow, Section } from "@/components/shared/Section";
import { ErrorState, ListSkeleton, PageLoader } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/input";
import { useSessione } from "@/lib/auth";
import { mostraErrore } from "@/lib/errors";
import { dataBreve, dataOra, euro, nomeCompleto, relativo } from "@/lib/format";
import { FONTI, STATI_LEAD } from "@/lib/labels";
import { linkEmail, linkTelefono, linkWhatsApp } from "@/lib/messaggi";
import { useColleghi } from "@/lib/queries";
import { DocumentiSezione } from "./Documenti";
import { ModificaClienteDialog } from "./ModificaClienteDialog";
import { NuovoLeadClienteDialog } from "./NuovoLeadClienteDialog";
import { useAcquistiContatto, useAggiornaContatto, useContatto, useLeadContatto } from "./api";

export default function ClienteDetailPage() {
  const { id } = useParams();
  const { isAmministrazione } = useSessione();
  const contatto = useContatto(id);
  const leads = useLeadContatto(id);
  const acquisti = useAcquistiContatto(id);
  const colleghi = useColleghi();
  const aggiorna = useAggiornaContatto();
  const [modifica, setModifica] = useState(false);
  const [nuovoLead, setNuovoLead] = useState(false);

  if (contatto.isLoading) return <PageLoader />;
  if (contatto.isError || !contatto.data)
    return (
      <>
        <BackLink to="/clienti" label="Clienti" />
        <ErrorState error={contatto.error} title="Cliente non trovato" onRetry={() => void contatto.refetch()} />
      </>
    );

  const c = contatto.data;
  const nome = nomeCompleto(c);
  const venditore = colleghi.data?.find((p) => p.user_id === c.venditore_assegnato)?.nome;
  const puoModificare = !isAmministrazione;

  async function cambiaConsenso(campo: "consenso_privacy" | "consenso_marketing", valore: boolean) {
    try {
      await aggiorna.mutateAsync({ id: c.id, [campo]: valore });
      toast.success(valore ? "Consenso registrato" : "Consenso revocato");
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a salvare il consenso.");
    }
  }

  return (
    <>
      <BackLink to="/clienti" label="Clienti" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar nome={nome} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-[28px] font-bold leading-tight tracking-tight">{nome}</h1>
            <p className="text-[17px] text-muted-foreground">
              {[c.comune, c.fonte && `arrivato da ${FONTI[c.fonte]}`].filter(Boolean).join(" · ") || "Cliente"}
            </p>
            {c.tag.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.tag.map((t) => (
                  <Badge key={t} tone="blue" size="sm" dot={false}>
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        {!isAmministrazione && (
          <Button variant="accent" onClick={() => setNuovoLead(true)}>
            <Plus aria-hidden /> Nuovo lead per questo cliente
          </Button>
        )}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2 sm:flex sm:gap-3">
        <Button asChild variant="outline" className="flex-col gap-1 sm:flex-row sm:gap-2">
          {c.telefono ? (
            <a href={linkTelefono(c.telefono)}>
              <Phone aria-hidden /> Chiama
            </a>
          ) : (
            <span aria-disabled className="opacity-50">
              <Phone aria-hidden /> Chiama
            </span>
          )}
        </Button>
        <Button asChild variant="outline" className="flex-col gap-1 sm:flex-row sm:gap-2">
          {c.telefono ? (
            <a href={linkWhatsApp(c.telefono, `Buongiorno ${c.nome}, `)} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden /> WhatsApp
            </a>
          ) : (
            <span aria-disabled className="opacity-50">
              <MessageCircle aria-hidden /> WhatsApp
            </span>
          )}
        </Button>
        <Button asChild variant="outline" className="flex-col gap-1 sm:flex-row sm:gap-2">
          {c.email ? (
            <a href={linkEmail(c.email)}>
              <Mail aria-hidden /> Email
            </a>
          ) : (
            <span aria-disabled className="opacity-50">
              <Mail aria-hidden /> Email
            </span>
          )}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-5">
          <Section
            title="Dati del cliente"
            action={
              puoModificare && (
                <Button variant="ghost" size="sm" onClick={() => setModifica(true)}>
                  <Pencil aria-hidden /> Modifica
                </Button>
              )
            }
          >
            <dl>
              <InfoRow label="Telefono">{c.telefono}</InfoRow>
              <InfoRow label="Email">{c.email && <span className="break-all">{c.email}</span>}</InfoRow>
              <InfoRow label="Comune">{c.comune}</InfoRow>
              <InfoRow label="Venditore">{venditore}</InfoRow>
              <InfoRow label="In archivio dal">{dataBreve(c.created_at)}</InfoRow>
            </dl>
            {c.note && <p className="mt-3 whitespace-pre-line rounded-lg bg-muted p-3 text-[15px]">{c.note}</p>}
          </Section>

          <Section title="Consensi">
            <div className="space-y-3">
              <Switch
                id="cons-privacy"
                label="Privacy"
                description={c.consenso_privacy_at ? `Dato il ${dataOra(c.consenso_privacy_at)}` : "Trattamento dei dati per la trattativa"}
                checked={c.consenso_privacy}
                onChange={(v) => puoModificare && !aggiorna.isPending && void cambiaConsenso("consenso_privacy", v)}
              />
              <Switch
                id="cons-marketing"
                label="Marketing"
                description={c.consenso_marketing_at ? `Dato il ${dataOra(c.consenso_marketing_at)}` : "Offerte e comunicazioni commerciali"}
                checked={c.consenso_marketing}
                onChange={(v) => puoModificare && !aggiorna.isPending && void cambiaConsenso("consenso_marketing", v)}
              />
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Acquisti" count={acquisti.data?.length}>
            {acquisti.isLoading ? (
              <ListSkeleton rows={1} />
            ) : acquisti.isError ? (
              <ErrorState error={acquisti.error} onRetry={() => void acquisti.refetch()} />
            ) : !acquisti.data?.length ? (
              <p className="text-[15px] text-muted-foreground">Nessun acquisto finora.</p>
            ) : (
              <ul className="divide-y">
                {acquisti.data.map((d) => (
                  <li key={d.id}>
                    <Link to={`/pratiche/${d.id}`} className="flex items-center gap-3 py-3 hover:text-accent">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {d.vehicles ? `${d.vehicles.marca} ${d.vehicles.modello}` : "Auto"}
                          {d.vehicles?.targa && <span className="font-normal text-muted-foreground"> · {d.vehicles.targa}</span>}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Venduta il {dataBreve(d.data_vendita)} · pratica al {d.avanzamento}%
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">{euro(d.prezzo_finale)}</span>
                      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Lead" count={leads.data?.length}>
            {leads.isLoading ? (
              <ListSkeleton rows={2} />
            ) : leads.isError ? (
              <ErrorState error={leads.error} onRetry={() => void leads.refetch()} />
            ) : !leads.data?.length ? (
              <EmptyState
                compact
                art="lead"
                title="Nessun lead"
                text="Crea un lead per seguire una nuova richiesta di questo cliente."
                action={
                  !isAmministrazione && (
                    <Button variant="outline" onClick={() => setNuovoLead(true)}>
                      Nuovo lead
                    </Button>
                  )
                }
              />
            ) : (
              <ul className="divide-y">
                {leads.data.map((l) => {
                  const st = STATI_LEAD[l.stato];
                  const auto = l.veicolo_marca ? `${l.veicolo_marca} ${l.veicolo_modello}` : [l.marca_interesse, l.modello_interesse].filter(Boolean).join(" ");
                  return (
                    <li key={l.id}>
                      <Link to={`/lead/${l.id}`} className="flex items-center gap-3 py-3 hover:text-accent">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{auto || "Richiesta generica"}</p>
                          <p className="text-sm text-muted-foreground">
                            {FONTI[l.fonte]} · {relativo(l.created_at)}
                            {l.assegnato_nome && ` · ${l.assegnato_nome}`}
                            {l.stato === "perso" && l.motivo_perso && ` · ${l.motivo_perso}`}
                          </p>
                        </div>
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <DocumentiSezione rif={{ tipo: "contatto", id: c.id }} />
        </div>
      </div>

      <ModificaClienteDialog contatto={c} open={modifica} onOpenChange={setModifica} />
      {nuovoLead && <NuovoLeadClienteDialog contatto={c} open={nuovoLead} onOpenChange={setNuovoLead} />}
    </>
  );
}
