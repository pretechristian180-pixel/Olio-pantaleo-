import { requireStaff } from "@/lib/auth";
import { getOrders } from "@/lib/data/admin-panel";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireStaff();
  const orders = await getOrders(5000);
  const csv = toCsv([
    ["Data", "Corso", "Email", "Importo", "Valuta", "Stato", "ID ordine"],
    ...orders.map((o) => [
      (o.pagato_il ?? o.creato_il).slice(0, 10),
      o.corso,
      o.email,
      (o.importo_cents / 100).toFixed(2).replace(".", ","),
      o.valuta,
      o.stato,
      o.id,
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vendite-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
