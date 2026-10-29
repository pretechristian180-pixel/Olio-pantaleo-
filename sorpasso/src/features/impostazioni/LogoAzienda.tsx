import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared/Section";
import { Spinner } from "@/components/shared/States";
import { useSessione } from "@/lib/auth";
import { mostraErrore, ok } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

const BUCKET = "loghi";
const FORMATI = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTE = 2 * 1024 * 1024;

/** Percorso nel bucket a partire dall'URL pubblico (per eliminare il vecchio file). */
function percorsoDaUrl(url: string) {
  const i = url.indexOf(`/${BUCKET}/`);
  return i >= 0 ? decodeURIComponent(url.slice(i + BUCKET.length + 2).split("?")[0]!) : null;
}

/** Logo della concessionaria: compare sulla scheda PDF e sulla pagina pubblica delle auto. */
export function LogoAzienda() {
  const { organizzazione: org, isTitolare, ricarica } = useSessione();
  const input = useRef<HTMLInputElement>(null);
  const [inCorso, setInCorso] = useState(false);

  async function carica(file: File) {
    if (!FORMATI.includes(file.type)) return toast.error("Usa un'immagine PNG, JPG, WebP o SVG.");
    if (file.size > MAX_BYTE) return toast.error("Il logo deve pesare meno di 2 MB.");
    setInCorso(true);
    try {
      const est = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "png";
      const path = `${org.id}/logo-${Date.now()}.${est}`;
      ok(await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" }));
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      ok(await supabase.from("organizations").update({ logo_url: url }).eq("id", org.id));
      const vecchio = org.logo_url && percorsoDaUrl(org.logo_url);
      if (vecchio) await supabase.storage.from(BUCKET).remove([vecchio]);
      await ricarica();
      toast.success("Logo aggiornato");
    } catch (e) {
      mostraErrore(e, "Non sono riuscito a caricare il logo.");
    } finally {
      setInCorso(false);
      if (input.current) input.current.value = "";
    }
  }

  async function rimuovi() {
    if (!org.logo_url || !window.confirm("Rimuovere il logo?")) return;
    setInCorso(true);
    try {
      ok(await supabase.from("organizations").update({ logo_url: null }).eq("id", org.id));
      const path = percorsoDaUrl(org.logo_url);
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      await ricarica();
      toast.success("Logo rimosso");
    } catch (e) {
      mostraErrore(e);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <Section title="Logo">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-24 w-48 shrink-0 items-center justify-center rounded-lg border bg-muted p-3">
          {org.logo_url ? (
            <img src={org.logo_url} alt={`Logo ${org.nome}`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-sm text-muted-foreground">Nessun logo</span>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-[15px] text-muted-foreground">
            Compare sulla scheda tecnica PDF e sulla pagina pubblica delle auto. Meglio un PNG con sfondo trasparente.
          </p>
          {isTitolare ? (
            <div className="flex flex-wrap gap-2">
              <input
                ref={input}
                type="file"
                accept={FORMATI.join(",")}
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && void carica(e.target.files[0])}
              />
              <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={inCorso}>
                {inCorso ? <Spinner /> : <ImageUp aria-hidden />}
                {org.logo_url ? "Cambia logo" : "Carica logo"}
              </Button>
              {org.logo_url && (
                <Button type="button" variant="ghost" className="text-destructive" onClick={rimuovi} disabled={inCorso}>
                  <Trash2 aria-hidden />
                  Rimuovi
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Solo il titolare può cambiare il logo.</p>
          )}
        </div>
      </div>
    </Section>
  );
}
