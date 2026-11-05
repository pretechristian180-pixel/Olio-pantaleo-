import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { NewTenant } from "@/components/platform/new-tenant";
import { publicEnv } from "@/lib/env";
import { Stat } from "@/components/ui/stat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_LABELS, TenantStatusBadge } from "@/components/platform/status-badge";
import { getPlatformOverview, getPlatformTenants, type TenantStatus } from "@/lib/data/platform";
import { formatDate } from "@/lib/format-date";
import { formatPrice, cn } from "@/lib/utils";

const FILTRI: TenantStatus[] = ["prova", "attivo", "insoluto", "sospeso", "chiuso"];

export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stato?: string }>;
}) {
  const sp = await searchParams;
  const stato = FILTRI.includes(sp.stato as TenantStatus) ? (sp.stato as TenantStatus) : undefined;
  const [n, tenants] = await Promise.all([getPlatformOverview(), getPlatformTenants(sp.q, stato)]);
  const giorni = (iso: string | null) =>
    iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Super-admin"
        title="Le academy dei clienti"
        description="Tutte le aziende che usano Nexora Academy: piano, stato dell'abbonamento, pagamenti e numeri."
      />
      <NewTenant rootDomain={publicEnv.NEXT_PUBLIC_ROOT_DOMAIN} />
      <section
        aria-label="Numeri della piattaforma"
        className="grid grid-cols-2 gap-4 xl:grid-cols-4"
      >
        <Stat
          label="Incasso mensile ricorrente"
          value={formatPrice(n.mrr_cents, "EUR")}
          hint="abbonamenti attivi, IVA esclusa"
          tone="tint"
        />
        <Stat label="Academy attive" value={n.attive} hint={`${n.academy_totali} in totale`} />
        <Stat
          label="In prova"
          value={n.in_prova}
          hint={
            n.prove_in_scadenza
              ? `${n.prove_in_scadenza} scadono entro 7 giorni`
              : "nessuna in scadenza"
          }
        />
        <Stat
          label="Da seguire"
          value={n.insolute + n.sospese}
          hint={`${n.insolute} insolute · ${n.sospese} sospese`}
        />
      </section>
      <p className="text-sm text-ink-muted">
        Studenti nelle academy dei clienti:{" "}
        <strong className="text-ink">{n.studenti_totali}</strong> · Vendite dei clienti questo mese:{" "}
        <strong className="text-ink">{formatPrice(n.vendite_mese_cents, "EUR")}</strong> (incassate
        da loro, 0% a Nexora)
      </p>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form role="search" action="/piattaforma" className="flex flex-1 gap-2">
          {stato && <input type="hidden" name="stato" value={stato} />}
          <label htmlFor="q" className="sr-only">
            Cerca academy
          </label>
          <Input id="q" name="q" defaultValue={sp.q} placeholder="Cerca per nome o indirizzo" />
          <Button type="submit" variant="secondary" size="lg" aria-label="Cerca">
            <Search aria-hidden />
          </Button>
        </form>
        <nav aria-label="Filtra per stato" className="flex flex-wrap gap-2">
          <Filtro
            href={`/piattaforma${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ""}`}
            active={!stato}
          >
            Tutte
          </Filtro>
          {FILTRI.map((s) => (
            <Filtro
              key={s}
              href={`/piattaforma?stato=${s}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}
              active={stato === s}
            >
              {STATUS_LABELS[s]}
            </Filtro>
          ))}
        </nav>
      </div>

      {tenants.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nessuna academy"
          description="Quando un'azienda crea la sua academy da /crea-academy compare qui."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-200 text-left text-sm">
            <thead className="border-b border-line text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Academy</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Piano</th>
                <th className="px-4 py-3 font-medium">Stripe</th>
                <th className="px-4 py-3 text-right font-medium">Studenti</th>
                <th className="px-4 py-3 text-right font-medium">Corsi</th>
                <th className="px-4 py-3 text-right font-medium">Vendite</th>
                <th className="px-4 py-3 font-medium">Creata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tenants.map((t) => {
                const g = t.stato === "prova" ? giorni(t.prova_fine_il) : null;
                return (
                  <tr key={t.id} className="hover:bg-surface-alt">
                    <td className="px-4 py-3">
                      <Link
                        href={`/piattaforma/${t.id}`}
                        className="font-semibold hover:text-nexora-blue"
                      >
                        {t.nome}
                      </Link>
                      <span className="block text-ink-muted">{t.admin_email ?? t.slug}</span>
                    </td>
                    <td className="px-4 py-3">
                      <TenantStatusBadge stato={t.stato} />
                      {g !== null && (
                        <span
                          className={cn(
                            "mt-1 block text-xs",
                            g <= 3 ? "text-negative" : "text-ink-muted",
                          )}
                        >
                          {g > 0 ? `scade tra ${g} gg` : "prova scaduta"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.piano ?? "—"}
                      {t.abbonamento_attivo && (
                        <span className="block text-xs text-ink-muted">abbonato</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.pagamenti_attivi
                        ? "Incassa"
                        : t.stripe_collegato
                          ? "Da completare"
                          : "Non collegato"}
                    </td>
                    <td className="px-4 py-3 text-right">{t.studenti}</td>
                    <td className="px-4 py-3 text-right">{t.corsi}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {formatPrice(t.vendite_totali_cents, "EUR")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.creato_il)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Filtro({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center rounded-md px-4 text-sm font-semibold",
        active
          ? "bg-graphite-deep text-white"
          : "border border-line bg-surface hover:border-ink-muted",
      )}
    >
      {children}
    </Link>
  );
}
