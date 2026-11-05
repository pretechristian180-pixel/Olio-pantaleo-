import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { AdminMobileNav, AdminSidebar } from "@/components/layout/admin-sidebar";

export const metadata: Metadata = {
  title: { default: "Amministrazione", template: "%s · Admin Nexora Academy" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  const tenant = await getCurrentTenant();
  const giorni = tenant?.provaFineIl
    ? Math.max(0, Math.ceil((new Date(tenant.provaFineIl).getTime() - Date.now()) / 86_400_000))
    : null;
  return (
    <div className="flex min-h-dvh bg-surface-alt">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav />
        {tenant?.stato === "prova" && giorni !== null && (
          <p className="bg-blue-tint px-4 py-3 text-sm text-nexora-blue-deep sm:px-6 lg:px-12">
            Sei in prova gratuita: {giorni === 1 ? "manca 1 giorno" : `mancano ${giorni} giorni`}.
            Prepara i corsi con calma, l&apos;abbonamento si attiva quando sei pronto.{" "}
            <Link href="/admin/impostazioni" className="font-semibold underline underline-offset-2">
              Impostazioni
            </Link>
          </p>
        )}
        {(tenant?.stato === "insoluto" || tenant?.stato === "sospeso") && (
          <p
            role="alert"
            className="bg-negative px-4 py-3 text-sm font-semibold text-white sm:px-6 lg:px-12"
          >
            {tenant.stato === "insoluto"
              ? "L'ultimo pagamento dell'abbonamento non è andato a buon fine: aggiorna il metodo di pagamento."
              : "L'academy è sospesa e non è visibile agli studenti."}
          </p>
        )}
        <main id="contenuto" className="flex-1 px-4 py-6 sm:px-6 lg:px-12 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
