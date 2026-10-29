import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Megaphone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queries";

interface Provenienza {
  listing_id: string | null;
  vehicle_listings: { portal_id: string; url: string | null; portals: { nome: string } | null } | null;
}

/** "Arrivato dall'annuncio su AutoScout24": il lead è collegato all'annuncio del portale da cui ha scritto. */
export function ProvenienzaAnnuncio({ leadId }: { leadId: string }) {
  const q = useQuery({
    queryKey: [...qk.lead, "provenienza", leadId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("listing_id, vehicle_listings(portal_id, url, portals(nome))")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Provenienza | null;
    },
  });
  const annuncio = q.data?.vehicle_listings;
  if (!q.data?.listing_id || !annuncio) return null;
  const portale = annuncio.portals?.nome ?? annuncio.portal_id;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Megaphone className="size-4" aria-hidden />
      {annuncio.url ? (
        <a href={annuncio.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          Dall'annuncio su {portale} <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : (
        <span>Dall'annuncio su {portale}</span>
      )}
    </span>
  );
}
