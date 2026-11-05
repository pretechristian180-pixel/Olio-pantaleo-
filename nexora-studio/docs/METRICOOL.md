# Pubblicazione con Metricool

Nexora Studio pubblica tramite Metricool (adapter `PublishingProvider`,
`packages/shared/src/providers/metricool.ts`). In futuro si potrà passare alle API dirette di
Meta, TikTok e YouTube senza toccare il resto del codice.

## Configurazione (una volta)
1. Serve un piano Metricool con accesso API (Advanced o superiore).
2. Variabili d'ambiente del **worker** (e dell'app per la sola lettura dello stato):
   - `METRICOOL_API_TOKEN`: Metricool → Impostazioni → API;
   - `METRICOOL_USER_ID`: lo user id dell'account;
   - `PUBLISHING_PROVIDER=metricool` (in locale `demo`).

## Per ogni nuova azienda (team Nexora)
1. In Metricool crea un **brand** per l'azienda. Metricool ammette un solo profilo per social per brand.
2. Copia il **blogId** del brand (è nell'URL del brand in Metricool).
3. In Metricool: brand → *Connessioni* → *Condividi* → **Crea link** (valido 71 ore).
4. In Nexora Studio vai su `/admin/social`, incolla blogId e link, poi **Salva e sincronizza**.
5. Il cliente trova il pulsante **Collega i social** nella pagina Social. Dopo il collegamento tocca
   "Ho collegato, aggiorna" (il worker risincronizza comunque ogni ora).

Se il link scade, il cliente tocca "Chiedi il link" e il team riceve un'email (`ADMIN_ALERT_EMAIL`).

## Come avviene una pubblicazione
1. Il cliente approva il video, che entra nel primo spazio libero (giorni e orario scelti
   nell'onboarding, nel fuso dell'azienda). Una regola nel database impedisce di programmare un
   video non approvato.
2. Il video si può spostare nel calendario fino a 20 minuti prima dell'uscita.
3. 15 minuti prima il worker consegna il post a Metricool, che lo pubblica all'orario come Reel o
   Short su tutti i social collegati e attivi. Il link al video è firmato e valido 48 ore.
4. Dopo l'orario il worker verifica l'esito ogni 5 minuti per un'ora. Se un social non va a buon
   fine: post in errore, email all'azienda e riprogrammazione dalla pagina del video.

## Da verificare con il primo token reale
L'adapter segue la struttura documentata (`POST /api/v2/scheduler/posts`, header `X-Mc-Auth`,
parametri `userId` e `blogId`). La lettura delle risposte (id del post, stato per rete, elenco dei
brand in `/admin/simpleProfiles`) è difensiva e va confermata con una chiamata vera. Va verificato
anche se servono la normalizzazione dei media o un URL senza scadenza.
