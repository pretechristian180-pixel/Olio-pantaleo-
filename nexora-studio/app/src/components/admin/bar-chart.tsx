/**
 * Barre verticali a una serie (es. video al giorno): barre sottili con estremità arrotondate,
 * griglia leggera, dettaglio al passaggio o al focus, tabella dei dati per chi non vede il grafico.
 */
export function BarChart({
  data,
  label,
  unit,
}: {
  data: { key: string; label: string; value: number }[];
  label: string;
  unit: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  return (
    <figure className="grid gap-2">
      <div
        className="relative h-40"
        role="img"
        aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}
      >
        {[1, 0.5].map((f) => (
          <div
            key={f}
            className="absolute inset-x-0 border-t border-border/60"
            style={{ bottom: `${f * 100}%` }}
          >
            <span className="absolute -top-2 right-0 bg-card pl-1 text-[0.625rem] text-muted-foreground tabular-nums">
              {Math.round(nice * f)}
            </span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 border-t border-border" />
        <div className="absolute inset-0 right-6 flex items-end gap-[2px]">
          {data.map((d) => (
            <div
              key={d.key}
              tabIndex={0}
              className="group relative flex h-full flex-1 items-end justify-center outline-none"
            >
              <div
                className="w-full max-w-5 rounded-t-[4px] bg-nx-blue-500 transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                style={{
                  height: d.value ? `${(d.value / nice) * 100}%` : "2px",
                  opacity: d.value ? 1 : 0.3,
                }}
              />
              <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
                {d.label}: <strong className="tabular-nums">{d.value}</strong> {unit}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between pr-6 text-[0.625rem] text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Vedi i dati</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="font-medium">Giorno</th>
              <th className="text-right font-medium">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <td>{d.label}</td>
                <td className="text-right tabular-nums">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
