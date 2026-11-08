"use client";

import { ImagePlus, Loader2, Plus, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { extractColors, HEX_RE } from "@/lib/upload/colors";
import { safeFileName } from "@/lib/upload/resumable";
import { createClient } from "@/lib/supabase/client";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/**
 * Logo + colori del brand. Il logo va subito nel bucket privato "brand";
 * i colori vengono estratti dal logo e restano modificabili.
 * Scrive i valori in due input nascosti (logo_path, brand_colors) del form che lo contiene.
 */
export function LogoAndColors({
  workspaceId,
  initialLogoPath,
  initialLogoUrl,
  initialColors,
  disabled,
}: {
  workspaceId: string;
  initialLogoPath: string | null;
  initialLogoUrl: string | null;
  initialColors: string[];
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [logoPath, setLogoPath] = useState(initialLogoPath ?? "");
  const [preview, setPreview] = useState(initialLogoUrl);
  const [colors, setColors] = useState<string[]>(initialColors);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/"))
      return setError("Scegli un'immagine (PNG, JPG, SVG o WebP).");
    if (file.size > MAX_LOGO_BYTES) return setError("Il logo è troppo pesante: massimo 5 MB.");
    setBusy(true);
    try {
      const path = `${workspaceId}/logo/${Date.now()}-${safeFileName(file.name)}`;
      const { error: upErr } = await createClient()
        .storage.from("brand")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      setLogoPath(path);
      setPreview(URL.createObjectURL(file));
      const extracted = await extractColors(file).catch(() => []);
      if (extracted.length) setColors(extracted);
    } catch {
      setError("Caricamento non riuscito. Controlla la connessione e riprova.");
    } finally {
      setBusy(false);
    }
  }

  const setColor = (i: number, value: string) =>
    setColors((cs) => cs.map((c, j) => (j === i ? value : c)));

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
      <input type="hidden" name="logo_path" value={logoPath} />
      <input
        type="hidden"
        name="brand_colors"
        value={JSON.stringify(colors.filter((c) => HEX_RE.test(c)))}
      />

      <div className="grid justify-items-start gap-2">
        <span className="text-sm font-medium" id="logo-label">
          Logo
        </span>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          aria-labelledby="logo-label"
          aria-describedby="logo-hint"
          className="relative flex size-32 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-input bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px] transition-colors hover:border-nx-blue-500/60 disabled:opacity-60"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmato o locale, niente ottimizzazione
            <img src={preview} alt="Logo attuale" className="size-full object-contain p-3" />
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
              <ImagePlus className="size-6" aria-hidden />
              Carica il logo
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-6 animate-spin" aria-label="Caricamento" />
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
        <p id="logo-hint" className="max-w-32 text-xs text-muted-foreground">
          {preview ? "Tocca per cambiarlo." : "PNG o SVG, meglio con sfondo trasparente."}
        </p>
        {error && (
          <p role="alert" className="max-w-48 text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      <fieldset className="grid gap-3" disabled={disabled}>
        <legend className="mb-1 text-sm font-medium">Colori del brand</legend>
        <p className="text-[0.8125rem] text-muted-foreground">
          {colors.length
            ? "Li abbiamo presi dal logo. Toccali per cambiarli."
            : "Carica il logo e li ricaviamo da lì, oppure aggiungili tu."}
        </p>
        <ul className="flex flex-wrap gap-3">
          {colors.map((c, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border bg-card p-1.5 pr-2">
              <label
                className="relative size-9 cursor-pointer overflow-hidden rounded-md border"
                style={{ background: c }}
              >
                <span className="sr-only">Colore {i + 1}</span>
                <input
                  type="color"
                  value={HEX_RE.test(c) ? c : "#000000"}
                  onChange={(e) => setColor(i, e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <input
                aria-label={`Codice del colore ${i + 1}`}
                value={c}
                onChange={(e) => setColor(i, e.target.value.trim())}
                maxLength={7}
                className="w-20 bg-transparent font-mono text-xs uppercase outline-none"
              />
              <button
                type="button"
                onClick={() => setColors((cs) => cs.filter((_, j) => j !== i))}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={`Rimuovi il colore ${c}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
          {colors.length < 5 && (
            <li>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-[3.25rem]"
                onClick={() => setColors((cs) => [...cs, "#2b62e8"])}
              >
                <Plus aria-hidden /> Aggiungi
              </Button>
            </li>
          )}
        </ul>
      </fieldset>
    </div>
  );
}
