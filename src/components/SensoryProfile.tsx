import type { SensoryProfile as SensoryProfileType } from "@/lib/data/products";

const rows: { key: keyof SensoryProfileType; label: string }[] = [
  { key: "fruttato", label: "Fruttato" },
  { key: "amaro", label: "Amaro" },
  { key: "piccante", label: "Piccante" },
  { key: "intensita", label: "Intensità" },
];

export function SensoryProfile({ profile }: { profile: SensoryProfileType }) {
  return (
    <div className="space-y-3" role="img" aria-label="Profilo sensoriale dell'olio">
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[6rem_1fr] items-center gap-3 sm:grid-cols-[7rem_1fr]">
          <span className="text-sm text-bark">{row.label}</span>
          <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((step) => (
              <span
                key={step}
                className={`h-2.5 flex-1 rounded-full transition-colors ${
                  step <= profile[row.key] ? "bg-olive-600" : "bg-sand"
                }`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
