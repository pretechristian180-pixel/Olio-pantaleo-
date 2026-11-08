import type { Metadata } from "next";
import Link from "next/link";

import { LegalHeader, LegalTable, Section } from "@/components/legal/legal";

export const metadata: Metadata = { title: "Cookie policy" };

export default function CookiePage() {
  return (
    <article className="grid gap-8">
      <LegalHeader
        title="Cookie policy"
        subtitle="Ai sensi dell'art. 122 del Codice privacy e delle Linee guida del Garante del 10 giugno 2021."
      />

      <Section id="cosa-sono" title="1. Cosa sono i cookie">
        <p>
          I cookie sono piccoli file che un sito salva sul dispositivo dell&apos;utente. Questa
          policy vale anche per strumenti simili, come il local storage e i pixel.
        </p>
      </Section>

      <Section id="cookie-usati" title="2. Cookie usati da Christian Prete Studio">
        <LegalTable
          head={["Tipo", "A cosa servono", "Consenso", "Durata"]}
          rows={[
            [
              "Tecnici necessari",
              "Login, sicurezza, sessione, memoria delle scelte sui cookie, pagamento",
              "Non richiesto",
              "Sessione o fino a 12 mesi",
            ],
            [
              "Statistici anonimizzati",
              "Misurare l'uso del sito in forma aggregata, con IP mascherato e senza incrociare i dati",
              "Non richiesto",
              "Fino a 13 mesi",
            ],
            [
              "Statistici non anonimizzati",
              "Analisi dettagliate dell'uso del sito",
              "Richiesto",
              "Fino a 13 mesi",
            ],
            [
              "Marketing e profilazione",
              "Misurare le campagne pubblicitarie (es. pixel di Meta, Google Ads) e mostrare annunci mirati",
              "Richiesto",
              "Fino a 13 mesi",
            ],
          ]}
        />
        <p>
          <strong>Elenco aggiornato dei singoli cookie.</strong> Oggi Christian Prete Studio usa solo
          strumenti tecnici necessari:
        </p>
        <LegalTable
          head={["Nome", "Fornitore", "A cosa serve", "Durata"]}
          rows={[
            [
              "sb-…-auth-token",
              "Christian Prete Studio (Supabase)",
              "Mantiene l'accesso all'account (cookie)",
              "Fino all'uscita, al massimo 12 mesi",
            ],
            [
              "nx_ws",
              "Christian Prete Studio",
              "Ricorda l'azienda o il brand su cui stai lavorando (cookie)",
              "12 mesi",
            ],
            [
              "nexora-theme",
              "Christian Prete Studio",
              "Ricorda il tema chiaro o scuro (local storage)",
              "Finché non lo cancelli",
            ],
            [
              "tus::…",
              "Christian Prete Studio",
              "Permette di riprendere un caricamento interrotto (local storage)",
              "Fino alla fine del caricamento",
            ],
          ]}
        />
      </Section>

      <Section id="consenso" title="3. Come funziona il consenso">
        <p>
          Poiché oggi sono presenti solo cookie tecnici necessari, per i quali il consenso non è
          richiesto, il banner non viene mostrato. Se in futuro verranno usati cookie statistici non
          anonimizzati o di marketing, il consenso funzionerà così:
        </p>
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>
            Al primo accesso compare un banner. I cookie non necessari restano bloccati finché
            l&apos;utente non sceglie.
          </li>
          <li>
            Il banner offre «Accetta tutti», «Rifiuta» e «Personalizza». Chiudere il banner con la X
            equivale a rifiutare.
          </li>
          <li>Scorrere la pagina non vale come consenso.</li>
          <li>
            Il banner non viene riproposto a chi ha rifiutato prima di 6 mesi, salvo modifiche
            rilevanti ai cookie usati.
          </li>
          <li>
            La scelta può essere modificata in ogni momento dal link «Preferenze cookie» in fondo a
            ogni pagina.
          </li>
        </ul>
      </Section>

      <Section id="terze-parti" title="4. Cookie di terze parti">
        <p>
          I cookie di terze parti sono gestiti dai rispettivi fornitori secondo le loro informative.
          Oggi le pagine di Christian Prete Studio non contengono cookie di terze parti. Il pagamento avviene
          sulle pagine di Stripe, che applica la propria{" "}
          <a
            href="https://stripe.com/it/legal/cookies-policy"
            rel="noopener noreferrer"
            target="_blank"
          >
            cookie policy
          </a>
          .
        </p>
      </Section>

      <Section id="browser" title="5. Gestione dal browser">
        <p>
          L&apos;utente può anche cancellare o bloccare i cookie dalle impostazioni del browser.
          Bloccare i cookie tecnici può impedire il funzionamento della Piattaforma.
        </p>
      </Section>

      <Section id="titolare" title="6. Titolare e diritti">
        <p>
          Per il titolare, i diritti e i contatti vale quanto indicato nell&apos;
          <Link href="/privacy">Informativa privacy</Link>.
        </p>
      </Section>
    </article>
  );
}
