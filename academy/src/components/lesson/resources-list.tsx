import { Download, FileText } from "lucide-react";
import type { Resource } from "@/lib/data/student";

function size(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB`;
}

export function ResourcesList({ resources }: { resources: Resource[] }) {
  if (resources.length === 0) {
    return (
      <p className="text-[15px] text-ink-muted">
        Per questa lezione non ci sono materiali da scaricare.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {resources.map((r) => (
        <li key={r.id}>
          <a
            href={`/api/materiali/${r.id}`}
            className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4 hover:border-nexora-blue"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-blue-tint text-nexora-blue">
              <FileText aria-hidden className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.nome}</span>
              <span className="text-xs text-ink-muted">
                {r.tipo.toUpperCase()} · {size(r.dimensione_bytes)}
              </span>
            </span>
            <Download aria-hidden className="size-5 shrink-0" />
            <span className="sr-only">Scarica</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
