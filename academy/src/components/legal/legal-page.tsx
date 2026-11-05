import { PageHeader } from "@/components/layout/page-header";

/** Impaginazione comune dei documenti legali. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <PageHeader
        eyebrow="Note legali"
        title={title}
        description={`Ultimo aggiornamento: ${updated}`}
      />
      <div className="mt-8 space-y-4 text-[15px] leading-7 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_table]:w-full [&_td]:border-t [&_td]:border-line [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_th]:text-ink-muted">
        {children}
      </div>
    </div>
  );
}

/** Un dato legale, o un segnaposto evidente se manca. */
export function V({ v, label }: { v: string; label: string }) {
  return v ? (
    <>{v}</>
  ) : (
    <mark className="rounded-sm bg-negative/10 px-1 text-negative">[{label} da completare]</mark>
  );
}
