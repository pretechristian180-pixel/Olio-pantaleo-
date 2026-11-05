# Nexora Studio — base grafica

Riferimento visivo vivo: pagina `/design-system` dell'app (non indicizzata).

## Logo
- `app/src/components/brand/logo.tsx`
  - `NexoraMark`: la "N" in vettoriale, ricostruita dal logo ufficiale (blu a sinistra, argento a destra). Si legge su fondo scuro e chiaro.
  - `NexoraWordmark`: scritta NEXORA in Michroma con la X blu.
  - `NexoraLogo`: marchio + NEXORA + "Studio", per header e accessi.
- File originali e derivati in `app/public/brand/`:
  - `nexora-mark.svg` (vettoriale), `nexora-mark-light.png` (originale su bianco), `nexora-logo-lockup-dark.png` (N + scritta su nero), icone PWA 192/512.
- Icone dell'app in `app/src/app/`: `icon.svg`, `favicon.ico`, `apple-icon.png`, `opengraph-image.png` (anteprima nei link condivisi).

## Colori (da `app/src/app/globals.css`)
| Nome | Token | Valore | Uso |
| --- | --- | --- | --- |
| Blu Nexora | `--nx-blue-500` | `#0A5CFF` | Primario, pulsanti |
| Riflesso ciano | `--nx-cyan-400` | `#1AA8FF` | Inizio del gradiente, bagliori |
| Blu profondo | `--nx-blue-700` | `#0028D0` | Fine del gradiente, hover |
| Blu chiaro | `--nx-blue-300` | `#6EA4FF` | Link e testo blu nel tema scuro |
| Argento | `--nx-silver-300` | `#C9CBD1` | Gradiente argento |
| Inchiostro | `--nx-ink-950` | `#05070D` | Sfondo del tema scuro |

- Gradiente del brand (`bg-brand-gradient`, `text-brand-gradient`) e argento (`text-silver`, più scuro nel tema chiaro per restare leggibile).
- Bagliore blu del logo: `shadow-glow` e `bg-aurora` (solo nel tema scuro).
- Colori di interfaccia semantici (cambiano col tema): `background`, `card`, `primary`, `primary-text`, `muted`, `accent`, `success`, `warning`, `destructive`, con le varianti `*-soft` per badge e avvisi.
- Regola: nei componenti si usano solo i token, mai colori scritti a mano.

## Tipografia
- Titoli: **Sora** (`font-display`), geometrico come il logo.
- Testo: **Inter** (`font-sans`).
- Solo per la scritta NEXORA: **Michroma** (`font-wordmark`), il lettering largo del logo.

## Temi
Scuro di base, chiaro e "sistema". Il selettore è nel menu account, e la scelta resta salvata nel browser (`next-themes`).

## Componenti
- `components/ui`: Button (varianti `brand`, `default`, `outline`, `secondary`, `ghost`, `link`, `destructive`), Input, Textarea, Label, Field (etichetta, aiuto ed errore già collegati per l'accessibilità), Card, Badge, Alert, Progress, Skeleton, Avatar, DropdownMenu, Separator, Toaster.
- `components/layout`:
  - AppShell: barra laterale su desktop; su mobile barra in basso con il tasto centrale "Carica".
  - PageHeader / PageContainer, EmptyState, VideoStatusBadge (stati del video in parole semplici), UsageMeter.

## Mobile e accessibilità
- Target touch di almeno 44px. Nei campi il testo è a 16px su mobile, così iOS non fa lo zoom.
- Tiene conto del notch (`safe-area-inset`), ha il link "Vai al contenuto" e un focus visibile.
- Rispetta "riduci movimento" del sistema.
- Contrasti AA per il testo normale in entrambi i temi.
