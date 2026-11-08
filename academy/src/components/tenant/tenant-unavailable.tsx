import Link from "next/link";
import { publicEnv } from "@/lib/env";

/** Academy inesistente o sospesa. Volutamente senza marchio del cliente. */
export function TenantUnavailable({ motivo }: { motivo: "non-trovata" | "sospesa" }) {
  return (
    <main
      id="contenuto"
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-surface px-4 text-center"
    >
      <p className="font-display text-2xl">CHRISTIAN PRETE</p>
      <h1 className="text-xl font-semibold">
        {motivo === "non-trovata"
          ? "Questa academy non esiste"
          : "Questa academy non è disponibile al momento"}
      </h1>
      <p className="max-w-md text-ink-muted">
        {motivo === "non-trovata"
          ? "Controlla l'indirizzo. Se vuoi creare la tua academy, parti da qui."
          : "Se sei il titolare, accedi al pannello per riattivarla."}
      </p>
      <Link
        href={`https://${publicEnv.NEXT_PUBLIC_ROOT_DOMAIN}${motivo === "non-trovata" ? "/crea-academy" : "/admin"}`}
        className="inline-flex h-11 items-center rounded-md bg-nexora-blue px-5 text-sm font-semibold text-white"
      >
        {motivo === "non-trovata" ? "Crea la tua academy" : "Vai al pannello"}
      </Link>
    </main>
  );
}
