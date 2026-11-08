import type { Metadata } from "next";
import Link from "next/link";

import {
  COMPANY,
  CONTACT_EMAIL,
  CONTACT_PEC,
  LegalHeader,
  LegalTable,
  Section,
} from "@/components/legal/legal";

export const metadata: Metadata = { title: "Informativa privacy" };

export default function PrivacyPage() {
  return (
    <article className="grid gap-8">
      <LegalHeader
        title="Informativa privacy"
        subtitle="Ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 («GDPR»)."
      />

      <Section id="titolare" title="1. Titolare del trattamento">
        <p>
          {COMPANY}. Contatti per la privacy:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, PEC{" "}
          <a href={`mailto:${CONTACT_PEC}`}>{CONTACT_PEC}</a>.
        </p>
      </Section>

      <Section id="ambito" title="2. A chi si applica">
        <p>
          Questa informativa riguarda chi visita il sito di Christian Prete Studio, chi si registra alla
          Piattaforma e i referenti delle aziende clienti. Per i dati delle persone che compaiono
          nei video caricati dai clienti, Christian Prete Studio agisce come responsabile del trattamento per conto
          del cliente: il titolare è l&apos;azienda cliente, che deve informare quelle persone.
        </p>
      </Section>

      <Section id="finalita" title="3. Dati, finalità e basi giuridiche">
        <LegalTable
          head={["Finalità", "Dati trattati", "Base giuridica", "Conservazione"]}
          rows={[
            [
              "Creare e gestire l'account, erogare il Servizio",
              "Nome, email, telefono, ruolo, dati aziendali, contenuti caricati, preferenze di brand",
              "Esecuzione del contratto (art. 6.1.b)",
              "Durata del contratto + 30 giorni",
            ],
            [
              "Pagamenti e fatturazione",
              "Ragione sociale, P.IVA, codice SDI o PEC, indirizzo, storico pagamenti (i dati della carta li tratta solo il fornitore di pagamenti)",
              "Obbligo di legge e contratto (art. 6.1.c e 6.1.b)",
              "10 anni (art. 2220 c.c.)",
            ],
            [
              "Assistenza e comunicazioni sul Servizio",
              "Messaggi, richieste, email di servizio",
              "Esecuzione del contratto (art. 6.1.b)",
              "Durata del contratto + 12 mesi",
            ],
            [
              "Sicurezza e prevenzione degli abusi",
              "Indirizzo IP, log di accesso, dati del dispositivo",
              "Legittimo interesse (art. 6.1.f)",
              "12 mesi",
            ],
            [
              "Statistiche d'uso del sito e della Piattaforma",
              "Dati di navigazione, anche tramite cookie",
              "Consenso o, per statistiche anonimizzate, legittimo interesse",
              <Link key="c" href="/cookie">
                Vedi Cookie policy
              </Link>,
            ],
            [
              "Newsletter e offerte commerciali",
              "Email, nome, azienda",
              "Consenso (art. 6.1.a), revocabile in ogni momento; per i clienti, comunicazioni su servizi analoghi secondo l'art. 130, comma 4, del Codice privacy",
              "Fino a revoca o opposizione",
            ],
            [
              "Tutela legale",
              "Dati necessari a far valere o difendere un diritto",
              "Legittimo interesse (art. 6.1.f)",
              "Per il tempo necessario",
            ],
          ]}
        />
        <p>
          Il conferimento dei dati per account, Servizio e fatturazione è necessario: senza questi
          dati il Servizio non può essere erogato.
        </p>
      </Section>

      <Section id="ai" title="4. Intelligenza artificiale">
        <p>
          I contenuti caricati sono elaborati da sistemi di intelligenza artificiale (trascrizione,
          montaggio, testi) per erogare il Servizio. Non vengono prese decisioni automatizzate che
          producono effetti giuridici sulle persone (art. 22 GDPR). I contenuti non sono usati per
          addestrare modelli di intelligenza artificiale.
        </p>
      </Section>

      <Section id="destinatari" title="5. Destinatari">
        <p>
          I dati sono trattati da personale autorizzato di Christian Prete Studio e da fornitori che agiscono come
          responsabili del trattamento:
        </p>
        <LegalTable
          head={["Fornitore", "Servizio", "Sede"]}
          rows={[
            ["Supabase", "Database, autenticazione, archiviazione file", "UE (Irlanda)"],
            ["Vercel", "Hosting della Piattaforma", "UE (Irlanda); società con sede negli USA"],
            [
              "Railway",
              "Elaborazione, trascrizione e montaggio dei video",
              "UE (Paesi Bassi); società con sede negli USA",
            ],
            ["Anthropic", "Generazione di testi e script", "USA"],
            [
              "Pexels",
              "Clip video di repertorio (riceve solo parole chiave, nessun dato personale)",
              "Germania",
            ],
            ["Metricool", "Pubblicazione sugli account social del cliente", "Spagna"],
            ["Resend", "Invio di email", "USA"],
            ["Sentry", "Monitoraggio degli errori tecnici della Piattaforma", "UE (Germania)"],
            ["Stripe", "Pagamenti (titolare autonomo per i dati di pagamento)", "UE/USA"],
            ["Studio commercialista incaricato", "Adempimenti fiscali", "Italia"],
          ]}
        />
        <p>
          I dati non sono venduti né diffusi. Possono essere comunicati alle autorità quando la
          legge lo richiede.
        </p>
      </Section>

      <Section id="trasferimenti" title="6. Trasferimenti fuori dall'UE">
        <p>
          Alcuni fornitori hanno sede o server fuori dallo Spazio economico europeo, in particolare
          negli USA. Il trasferimento avviene sulla base del Data Privacy Framework UE-USA, se il
          fornitore vi aderisce, o delle Clausole contrattuali tipo approvate dalla Commissione
          europea (art. 46 GDPR). Copia delle garanzie può essere richiesta ai contatti indicati.
        </p>
      </Section>

      <Section id="sicurezza" title="7. Sicurezza">
        <p>
          Christian Prete Studio adotta misure tecniche e organizzative adeguate: cifratura dei dati in transito e a
          riposo, accessi limitati per ruolo, separazione dei dati tra clienti, link ai file con
          scadenza, backup periodici.
        </p>
      </Section>

      <Section id="diritti" title="8. Diritti degli interessati">
        <p>
          L&apos;interessato può chiedere in ogni momento accesso, rettifica, cancellazione,
          limitazione, portabilità dei dati e opporsi al trattamento (artt. 15-22 GDPR), oltre a
          revocare il consenso senza pregiudicare i trattamenti già svolti. Le richieste vanno
          inviate a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>; la risposta arriva
          entro 30 giorni. È possibile proporre reclamo al Garante per la protezione dei dati
          personali (
          <a href="https://www.garanteprivacy.it" rel="noopener noreferrer" target="_blank">
            www.garanteprivacy.it
          </a>
          ).
        </p>
      </Section>

      <Section id="modifiche" title="9. Modifiche">
        <p>
          L&apos;informativa può essere aggiornata. Le modifiche rilevanti vengono comunicate agli
          utenti registrati via email.
        </p>
      </Section>
    </article>
  );
}
