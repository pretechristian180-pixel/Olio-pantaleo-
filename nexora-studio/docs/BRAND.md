# Christian Prete Studio — base grafica

Riferimento visivo vivo: pagina `/design-system` dell'app (non indicizzata).
Stessa identità di Christian Prete Agency (christianprete.it) e Christian Prete Academy.

## Logo
- `app/src/components/brand/logo.tsx` (i nomi dei componenti restano `Nexora*` per non toccare gli import):
  - `NexoraMark`: monogramma CP (C sfumata blu-ciano con piste a circuito). Le piste usano `currentColor`.
  - `NexoraWordmark`: scritta CHRISTIAN PRETE in Michroma.
  - `NexoraLogo`: monogramma + CHRISTIAN PRETE + "Studio", per header e accessi.
- File in `app/public/brand/`: `cp-mark.svg`, icone PWA `cp-icon-192.png` e `cp-icon-512.png`.
- Icone dell'app in `app/src/app/`: `icon.svg`, `favicon.ico`, `apple-icon.png`, `opengraph-image.png`.

## Colori (da `app/src/app/globals.css`)
| Nome | Token | Valore | Uso |
| --- | --- | --- | --- |
| Blu Christian Prete | `--nx-blue-500` | `#2B62E8` | Primario, pulsanti (AA con testo bianco) |
| Ciano | `--nx-cyan-400` | `#45D9FF` | Inizio del gradiente, bagliori, etichetta "Studio" |
| Blu profondo | `--nx-blue-700` | `#1D3FB8` | Fine del gradiente, hover |
| Blu chiaro | `--nx-blue-300` | `#6F9BFF` | Link e testo blu nel tema scuro |
| Inchiostro | `--nx-ink-950` | `#05070F` | Sfondo del tema scuro ("spazio") |

- Regola: nei componenti si usano solo i token, mai colori scritti a mano.

## Tipografia
- Titoli e testo: **Instrument Sans** (`font-display`, `font-sans`).
- Scritta CHRISTIAN PRETE: **Michroma** (`font-wordmark`).

## Temi
Scuro di base, chiaro e "sistema" (`next-themes`).
