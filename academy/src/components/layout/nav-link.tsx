"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, type NavItem } from "./nav";

type LinkItem = Pick<NavItem, "href" | "label" | "exact">;

type Variant = "dark" | "light" | "tab";

const styles: Record<Variant, { base: string; active: string; idle: string }> = {
  dark: {
    base: "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
    active: "bg-nexora-blue text-white",
    idle: "text-white/75 hover:bg-white/5 hover:text-white",
  },
  light: {
    base: "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
    active: "bg-blue-tint text-nexora-blue-deep",
    idle: "text-ink-muted hover:bg-surface-alt hover:text-ink",
  },
  tab: {
    base: "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold",
    active: "text-nexora-blue",
    idle: "text-ink-muted",
  },
};

export function NavLink({
  item,
  icon,
  variant,
}: {
  item: LinkItem;
  icon: React.ReactNode;
  variant: Variant;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item);
  const s = styles[variant];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(s.base, active ? s.active : s.idle)}
    >
      <span
        aria-hidden
        className={cn("flex shrink-0", variant === "tab" ? "[&_svg]:size-6" : "[&_svg]:size-5")}
      >
        {icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}
