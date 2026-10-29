import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ok } from "@/lib/errors";
import { qk } from "@/lib/queries";
import type { Vehicle } from "@/types/db";

/** Link della pagina pubblica dell'auto (nessun dato interno). */
export const linkPubblico = (token: string) => `${window.location.origin}/v/${token}`;

/** Condivisione su WhatsApp senza destinatario: il venditore sceglie la chat. */
export const linkCondividiWhatsApp = (testo: string) => `https://wa.me/?text=${encodeURIComponent(testo)}`;

export function useAggiornaPubblicazione() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Pick<Vehicle, "descrizione" | "descrizione_breve" | "pubblica">> & { id: string }) =>
      ok(await supabase.from("vehicles").update(patch).eq("id", id).select("id").single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.veicoli }),
  });
}

/** Copia negli appunti con un ripiego per i browser che non lo consentono. */
export async function copia(testo: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(testo);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = testo;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    const esito = document.execCommand("copy");
    t.remove();
    return esito;
  }
}
