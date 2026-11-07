import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatPrice } from "@/lib/utils";
import type { Plan } from "@/lib/data/plans";
import type { Tenant } from "@/lib/tenant";
import {
  connectStripe,
  openBillingPortal,
  startSubscription,
} from "@/app/admin/impostazioni/billing-actions";

/** Abbonamento a Nexora Academy: piano, stato, attivazione e gestione. */
export function SubscriptionCard({
  tenant,
  plans,
  hasSubscription,
  esito,
}: {
  tenant: Tenant;
  plans: Plan[];
  hasSubscription: boolean;
  esito?: string;
}) {
  const current = plans.find((p) => p.codice === tenant.piano?.codice) ?? plans[0];
  return (
    <Card>
      <CardBody className="space-y-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>Abbonamento</CardTitle>
          {tenant.omaggio.attivo && !tenant.omaggio.scaduto && !hasSubscription ? (
            <Badge tone="positive">Omaggio</Badge>
          ) : (
            <StatusBadge stato={tenant.stato} hasSubscription={hasSubscription} />
          )}
        </div>
        {esito === "ok" && (
          <Alert tone="success">
            Grazie! Il pagamento è registrato: lo stato si aggiorna entro pochi secondi.
          </Alert>
        )}
        {tenant.stato === "insoluto" && (
          <Alert>
            L&apos;ultimo pagamento non è andato a buon fine. Aggiorna la carta per non interrompere
            l&apos;academy.
          </Alert>
        )}
        {tenant.omaggio.attivo && !tenant.omaggio.scaduto && !hasSubscription ? (
          <Alert tone="success">
            La tua academy è in omaggio da Nexora
            {tenant.omaggio.fineIl
              ? ` fino al ${new Date(tenant.omaggio.fineIl).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}`
              : ", senza scadenza"}
            : non devi attivare nessun abbonamento.
          </Alert>
        ) : hasSubscription ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              Piano <strong className="text-ink">{tenant.piano?.nome ?? "—"}</strong>. Da qui vedi
              le fatture, cambi carta o piano, oppure disdici.
            </p>
            <form action={openBillingPortal}>
              <SubmitButton variant="secondary">Gestisci abbonamento e fatture</SubmitButton>
            </form>
          </div>
        ) : (
          <form action={startSubscription} className="space-y-5">
            <p className="text-sm text-ink-muted">
              {tenant.omaggio.scaduto
                ? "Il periodo in omaggio è terminato: attiva l'abbonamento per tenere aperta la tua academy."
                : tenant.stato === "prova"
                  ? "Attiva ora l'abbonamento: paghi solo dalla fine della prova gratuita."
                  : "Attiva l'abbonamento per tenere aperta la tua academy."}{" "}
              Prezzi IVA esclusa, disdici quando vuoi.
            </p>
            <fieldset className="grid gap-3 sm:grid-cols-3">
              <legend className="sr-only">Piano</legend>
              {plans.map((p) => (
                <label
                  key={p.codice}
                  className="flex cursor-pointer flex-col gap-1 rounded-md border border-line p-4 has-checked:border-nexora-blue has-checked:bg-blue-tint"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <input
                      type="radio"
                      name="piano"
                      value={p.codice}
                      defaultChecked={p.codice === current?.codice}
                      className="accent-nexora-blue"
                    />
                    {p.nome}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {formatPrice(p.prezzo_mese_cents, "EUR")} / mese
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="sr-only">Pagamento</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="intervallo"
                  value="mese"
                  defaultChecked
                  className="accent-nexora-blue"
                />
                Mensile
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="intervallo" value="anno" className="accent-nexora-blue" />
                Annuale (2 mesi gratis)
              </label>
            </fieldset>
            <SubmitButton pendingText="Apro il pagamento…">Attiva l&apos;abbonamento</SubmitButton>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

function StatusBadge({
  stato,
  hasSubscription,
}: {
  stato: Tenant["stato"];
  hasSubscription: boolean;
}) {
  if (stato === "attivo") return <Badge tone="positive">Attivo</Badge>;
  if (stato === "prova")
    return <Badge tone="blue">{hasSubscription ? "Prova, abbonamento attivo" : "In prova"}</Badge>;
  if (stato === "insoluto") return <Badge tone="negative">Pagamento non riuscito</Badge>;
  return <Badge tone="neutral">Sospeso</Badge>;
}

/** Conto Stripe del cliente: dove arrivano i soldi dei corsi venduti. */
export function PaymentsCard({
  connected,
  attivi,
  esito,
}: {
  connected: boolean;
  attivi: boolean;
  esito?: string;
}) {
  return (
    <Card>
      <CardBody className="space-y-4 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>Incassi dei corsi</CardTitle>
          {attivi ? (
            <Badge tone="positive">Pagamenti attivi</Badge>
          ) : connected ? (
            <Badge tone="neutral">Da completare</Badge>
          ) : (
            <Badge tone="neutral">Non collegato</Badge>
          )}
        </div>
        {esito === "riprova" && (
          <Alert>Il collegamento è scaduto. Riprendi da dove eri rimasto.</Alert>
        )}
        <p className="text-sm text-ink-muted">
          {attivi
            ? "I tuoi studenti pagano direttamente sul tuo conto Stripe. Nexora non trattiene nessuna percentuale: paghi solo le commissioni di Stripe."
            : "Collega il tuo conto Stripe per vendere i corsi. I soldi arrivano direttamente a te, senza commissioni Nexora. Servono pochi minuti: dati dell'azienda, documento e IBAN."}
        </p>
        {!attivi && (
          <form action={connectStripe}>
            <SubmitButton pendingText="Apro Stripe…">
              {connected ? "Completa il collegamento" : "Collega Stripe"}
            </SubmitButton>
          </form>
        )}
        {attivi && (
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-sm font-semibold text-nexora-blue hover:underline"
          >
            Apri la tua dashboard Stripe
          </a>
        )}
      </CardBody>
    </Card>
  );
}
