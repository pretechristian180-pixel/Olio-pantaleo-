import { useQuery } from "@tanstack/react-query";
import { supabase, BUCKET_DOCUMENTI, BUCKET_FOTO } from "@/lib/supabase";

/** Percorso di un file nello Storage: sempre sotto la cartella dell'organizzazione. */
export function percorsoFile(orgId: string, cartella: string, nomeFile: string) {
  const est = nomeFile.includes(".") ? nomeFile.split(".").pop()!.toLowerCase() : "bin";
  return `${orgId}/${cartella}/${crypto.randomUUID()}.${est}`;
}

/** URL firmati (validi 1 ora) per un elenco di foto: i bucket sono privati. */
export function useFotoUrls(paths: (string | null | undefined)[]) {
  const validi = paths.filter((p): p is string => !!p);
  return useQuery({
    queryKey: ["foto-urls", validi],
    enabled: validi.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET_FOTO).createSignedUrls(validi, 3600);
      if (error) throw error;
      return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl]));
    },
  });
}

export async function apriDocumento(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTI).createSignedUrl(path, 300);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

/** Riduce le foto lato client (max 1920px, JPEG) prima del caricamento: piazzale = rete lenta. */
export async function comprimiImmagine(file: File, maxLato = 1920, qualita = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scala = Math.min(1, maxLato / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scala);
  canvas.height = Math.round(bmp.height * scala);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", qualita));
}
