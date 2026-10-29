import type { ReactNode } from "react";

export function Sezione({
  id,
  occhiello,
  titolo,
  sottotitolo,
  children,
  className = "",
  centrata,
}: {
  id?: string;
  occhiello?: string;
  titolo: ReactNode;
  sottotitolo?: ReactNode;
  children: ReactNode;
  className?: string;
  centrata?: boolean;
}) {
  return (
    <section id={id} className={`py-20 sm:py-28 ${className}`} aria-labelledby={id ? `${id}-titolo` : undefined}>
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className={`rivela max-w-3xl ${centrata ? "mx-auto text-center" : ""}`}>
          {occhiello && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-accent-2">{occhiello}</p>}
          <h2 id={id ? `${id}-titolo` : undefined} className="text-[32px] font-extrabold sm:text-[44px]">
            {titolo}
          </h2>
          {sottotitolo && <p className="mt-4 text-[18px] text-muted sm:text-[20px]">{sottotitolo}</p>}
        </div>
        <div className="mt-12 sm:mt-14">{children}</div>
      </div>
    </section>
  );
}
