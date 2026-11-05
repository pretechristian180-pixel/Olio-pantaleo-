import { Logo } from "@/components/ui/logo";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCurrentTenant, isNexoraTenant } from "@/lib/tenant";

/** Metà sinistra scura con il claim, metà destra il modulo (mockup Login). */
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const [nexora, tenant] = await Promise.all([isNexoraTenant(), getCurrentTenant()]);
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="flex flex-col bg-graphite-deep px-6 py-8 text-white sm:px-14 sm:py-16">
        <Logo tone="dark" />
        <div className="my-10 lg:my-auto">
          {nexora ? (
            <>
              <Eyebrow tone="muted" className="text-ink-inverse-muted">
                Formazione per imprenditori
              </Eyebrow>
              <p className="mt-5 font-display text-[clamp(1.25rem,5.8vw,2.75rem)] leading-[1.3] uppercase lg:text-[clamp(1.5rem,2.9vw,3rem)]">
                Meno improvvisazione. Più sistema.
              </p>
              <p className="mt-6 hidden max-w-130 text-[17px] leading-7 text-ink-inverse-muted sm:block">
                I corsi Nexora su CRM, automazioni, AI e marketing aziendale. Pratici, registrati da
                chi questi sistemi li costruisce ogni giorno.
              </p>
            </>
          ) : (
            <>
              <Eyebrow tone="bright">Area riservata</Eyebrow>
              <p className="mt-5 text-[clamp(1.75rem,5vw,3rem)] leading-tight font-bold">
                {tenant?.nome}
              </p>
              {tenant?.brand.tagline && (
                <p className="mt-6 hidden max-w-130 text-[17px] leading-7 text-ink-inverse-muted sm:block">
                  {tenant.brand.tagline}
                </p>
              )}
            </>
          )}
        </div>
        <div aria-hidden className="hidden gap-2 lg:flex">
          <span className="h-1 w-10 rounded-full bg-nexora-blue" />
          <span className="h-1 w-4 rounded-full bg-nexora-blue-bright" />
          <span className="h-1 w-4 rounded-full bg-graphite" />
        </div>
      </aside>
      <main
        id="contenuto"
        className="flex items-center justify-center bg-surface px-6 py-12 sm:px-12"
      >
        <div className="w-full max-w-105">{children}</div>
      </main>
    </div>
  );
}

export function AuthTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-[28px] leading-tight font-bold">{title}</h1>
      {subtitle && <p className="mt-2 text-[15px] text-ink-muted">{subtitle}</p>}
    </div>
  );
}
