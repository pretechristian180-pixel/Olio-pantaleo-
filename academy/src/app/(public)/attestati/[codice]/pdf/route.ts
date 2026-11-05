import { buildCertificatePdf } from "@/lib/certificate-pdf";
import { getCertificate } from "@/lib/data/certificates";
import { originFromHost } from "@/lib/billing";
import { requestHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** PDF dell'attestato: pubblico con il codice, come la pagina di verifica. */
export async function GET(_req: Request, { params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params;
  const cert = await getCertificate(codice);
  if (!cert) return new Response("Attestato non trovato", { status: 404 });
  const origin = originFromHost(await requestHost()) ?? "";
  const bytes = await buildCertificatePdf(cert, `${origin}/attestati/${cert.codice}`);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="attestato-${cert.codice}.pdf"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
