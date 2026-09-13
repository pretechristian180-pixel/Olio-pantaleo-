export type Accent = "olive" | "gold" | "clay" | "forest";

export const accentBg: Record<Accent, string> = {
  olive: "bg-olive-100",
  gold: "bg-[#f1e6c8]",
  clay: "bg-[#f8dfe0]",
  forest: "bg-[#e2e6d4]",
};

export const accentText: Record<Accent, string> = {
  olive: "text-olive-700",
  gold: "text-gold-600",
  clay: "text-clay-600",
  forest: "text-forest-800",
};

export const accentBorder: Record<Accent, string> = {
  olive: "border-olive-300",
  gold: "border-gold-400",
  clay: "border-clay-400",
  forest: "border-forest-700",
};
