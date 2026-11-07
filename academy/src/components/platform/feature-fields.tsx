import { FEATURE_FIELDS, type Features } from "@/lib/features";

/** Campi delle funzioni incluse (si/no e limiti; numero vuoto = illimitato). */
export function FeatureFields({ defaults }: { defaults: Features }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-semibold">Funzioni incluse</legend>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {FEATURE_FIELDS.map((f) =>
          f.tipo === "si_no" ? (
            <label key={f.key} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                name={`f_${f.key}`}
                defaultChecked={defaults[f.key] as boolean}
                className="size-5 shrink-0 accent-nexora-blue"
              />
              {f.label}
            </label>
          ) : (
            <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
              <span>{f.label}</span>
              <input
                type="number"
                min={0}
                name={`f_${f.key}`}
                defaultValue={(defaults[f.key] as number | null) ?? ""}
                placeholder="Illimitato"
                className="h-11 w-32 rounded-md border border-line bg-surface px-3 text-right"
              />
            </label>
          ),
        )}
      </div>
      <p className="text-xs text-ink-muted">
        Partono da quelle del piano: cambia solo quello che vuoi personalizzare. Numero vuoto =
        illimitato.
      </p>
    </fieldset>
  );
}
