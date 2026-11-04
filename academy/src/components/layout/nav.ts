import {
  Award,
  BarChart3,
  BookOpen,
  CreditCard,
  Home,
  LayoutGrid,
  MessageSquare,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

export const studentNav: NavItem[] = [
  { href: "/app", label: "Home", icon: Home, exact: true },
  { href: "/app/corsi", label: "I miei corsi", icon: BookOpen },
  { href: "/corsi", label: "Catalogo", icon: LayoutGrid },
  { href: "/app/attestati", label: "Attestati", icon: Award },
  { href: "/app/community", label: "Community", icon: MessageSquare },
  { href: "/app/profilo", label: "Profilo", icon: User },
];

/** Tab bar mobile: solo le quattro voci principali. */
export const studentTabs: NavItem[] = [
  { href: "/app", label: "Home", icon: Home, exact: true },
  { href: "/app/corsi", label: "Corsi", icon: BookOpen },
  { href: "/app/attestati", label: "Attestati", icon: Award },
  { href: "/app/profilo", label: "Profilo", icon: User },
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Panoramica", icon: BarChart3, exact: true },
  { href: "/admin/corsi", label: "Corsi", icon: BookOpen },
  { href: "/admin/studenti", label: "Studenti", icon: Users },
  { href: "/admin/vendite", label: "Vendite", icon: CreditCard },
  { href: "/admin/domande", label: "Domande", icon: MessageSquare },
  { href: "/admin/impostazioni", label: "Impostazioni", icon: Settings },
];

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");
}
