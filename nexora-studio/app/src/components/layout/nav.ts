import {
  CalendarDays,
  Clapperboard,
  CreditCard,
  FileText,
  Home,
  Palette,
  Share2,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Sezioni principali: barra laterale su desktop, barra in basso su mobile. */
export const primaryNav: NavItem[] = [
  { href: "/inizio", label: "Home", icon: Home },
  { href: "/script", label: "Script", icon: FileText },
  { href: "/video", label: "Video", icon: Clapperboard },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
];

/** Impostazioni dell'azienda: barra laterale su desktop, menu account su mobile. */
export const settingsNav: NavItem[] = [
  { href: "/brand", label: "Brand", icon: Palette },
  { href: "/social", label: "Social", icon: Share2 },
  { href: "/piano", label: "Piano e fatturazione", icon: CreditCard },
  { href: "/team", label: "Team", icon: Users },
];

/** Azione più importante dell'app, sempre a un tocco. */
export const uploadHref = "/video/carica";

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
