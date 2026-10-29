import { BarChart3, Coins, CalendarDays, Car, FileCheck2, Settings, Sun, Target, Users, type LucideIcon } from "lucide-react";
import type { Ruolo } from "@/types/db";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Ruoli che vedono la voce (assente = tutti). */
  ruoli?: Ruolo[];
  /** Voce mostrata nella barra in basso su telefono. */
  mobile?: boolean;
}

export const navItems: NavItem[] = [
  { to: "/", label: "Oggi", icon: Sun, mobile: true },
  { to: "/lead", label: "Lead", icon: Target, mobile: true, ruoli: ["titolare", "responsabile_vendite", "venditore"] },
  { to: "/stock", label: "Stock", icon: Car, mobile: true },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, mobile: true },
  { to: "/clienti", label: "Clienti", icon: Users },
  { to: "/pratiche", label: "Pratiche", icon: FileCheck2 },
  { to: "/margini", label: "Margini", icon: Coins, ruoli: ["titolare", "responsabile_vendite", "amministrazione"] },
  { to: "/report", label: "Report", icon: BarChart3, ruoli: ["titolare", "responsabile_vendite"] },
  { to: "/impostazioni", label: "Impostazioni", icon: Settings },
];

export const navPerRuolo = (ruolo: Ruolo) => navItems.filter((i) => !i.ruoli || i.ruoli.includes(ruolo));
