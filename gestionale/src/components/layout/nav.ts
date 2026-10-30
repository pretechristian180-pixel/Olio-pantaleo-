import { CalendarDays, Handshake, House, Sun, Users, type LucideIcon } from "lucide-react";

/** Le 5 voci del menu: identiche su desktop (laterale) e telefono (in basso). */
export const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Oggi", icon: Sun },
  { to: "/immobili", label: "Immobili", icon: House },
  { to: "/contatti", label: "Contatti", icon: Users },
  { to: "/trattative", label: "Pipeline", icon: Handshake },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
];
