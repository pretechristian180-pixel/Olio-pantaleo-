"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Check, LogOut, Plus, ShieldCheck, Upload } from "lucide-react";

import { NexoraLogo, NexoraMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(auth)/actions";
import { switchWorkspace } from "@/lib/actions/workspace";
import { cn } from "@/lib/utils";

import { isActive, primaryNav, settingsNav, uploadHref, type NavItem } from "./nav";

export interface ShellUser {
  name: string;
  email: string;
  /** Team Nexora: mostra il collegamento all'area admin. */
  isAdmin?: boolean;
}

export interface ShellWorkspace {
  id: string;
  name: string;
  planLabel: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon className={cn("size-[1.125rem]", active && "text-primary-text")} aria-hidden />
      {item.label}
    </Link>
  );
}

function AccountMenu({
  user,
  workspace,
  workspaces,
}: {
  user: ShellUser;
  workspace: ShellWorkspace;
  workspaces: { id: string; name: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg p-1 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:w-full lg:p-2"
          aria-label={`Menu account di ${user.name}`}
        >
          <Avatar>
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 flex-1 lg:block">
            <span className="block truncate text-sm font-medium">{workspace.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.name}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate text-sm text-foreground">{user.name}</span>
          <span className="block truncate font-normal">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.length > 1 && (
          <>
            <DropdownMenuLabel>Le tue aziende</DropdownMenuLabel>
            {workspaces.map((w) => (
              <form key={w.id} action={switchWorkspace}>
                <input type="hidden" name="workspace_id" value={w.id} />
                <DropdownMenuItem asChild>
                  <button
                    type="submit"
                    className="w-full"
                    aria-current={w.id === workspace.id ? "true" : undefined}
                  >
                    <Building2 aria-hidden />
                    <span className="flex-1 truncate text-left">{w.name}</span>
                    {w.id === workspace.id && <Check className="text-primary-text" aria-hidden />}
                  </button>
                </DropdownMenuItem>
              </form>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <div className="lg:hidden">
          {settingsNav.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>
                <item.icon aria-hidden />
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
        </div>
        {user.isAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck aria-hidden />
                Area team Nexora
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <div className="px-1.5 py-1">
          <ThemeToggle className="w-full justify-between" />
        </div>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem variant="destructive" asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              Esci
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Struttura dell'area cliente.
 * Mobile: barra in alto (logo + account) e barra di navigazione in basso con il tasto "Carica".
 * Desktop (lg): barra laterale fissa con tutte le sezioni.
 */
export function AppShell({
  user,
  workspace,
  workspaces,
  children,
}: {
  user: ShellUser;
  workspace: ShellWorkspace;
  workspaces: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-1">
      <a
        href="#contenuto"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Vai al contenuto
      </a>

      {/* Barra laterale desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-card/40 lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/inizio" aria-label="Nexora Studio, vai alla Home">
            <NexoraLogo />
          </Link>
        </div>
        <div className="px-3 pb-2">
          <Button variant="brand" className="w-full" asChild>
            <Link href={uploadHref}>
              <Upload aria-hidden />
              Carica il video
            </Link>
          </Button>
        </div>
        <nav
          aria-label="Navigazione principale"
          className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4"
        >
          <div className="grid gap-0.5">
            {primaryNav.map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
          <div className="grid gap-0.5">
            <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              La tua azienda
            </p>
            {settingsNav.map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
          {user.isAdmin && (
            <div className="grid gap-0.5">
              <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Team Nexora
              </p>
              <SidebarLink
                item={{ href: "/admin", label: "Area team", icon: ShieldCheck }}
                pathname={pathname}
              />
            </div>
          )}
        </nav>
        <div className="border-t p-3">
          <p className="px-2 pb-2 text-xs text-muted-foreground">
            Piano <span className="font-medium text-foreground">{workspace.planLabel}</span>
          </p>
          <AccountMenu user={user} workspace={workspace} workspaces={workspaces} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra in alto mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-glass px-4 backdrop-blur-xl lg:hidden">
          <Link
            href="/inizio"
            aria-label="Nexora Studio, vai alla Home"
            className="flex items-center gap-2"
          >
            <NexoraMark className="h-6" title={null} />
            <span className="max-w-[12rem] truncate text-sm font-semibold">{workspace.name}</span>
          </Link>
          <AccountMenu user={user} workspace={workspace} workspaces={workspaces} />
        </header>

        <main id="contenuto" className="flex-1 pb-safe-nav lg:pb-10">
          {children}
        </main>

        {/* Barra di navigazione in basso mobile */}
        <nav
          aria-label="Navigazione principale"
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-glass pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        >
          <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
            {primaryNav.slice(0, 2).map((item) => (
              <BottomLink key={item.href} item={item} pathname={pathname} />
            ))}
            <li className="flex justify-center">
              <Link
                href={uploadHref}
                aria-label="Carica il video"
                className="flex size-13 -translate-y-3 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow ring-4 ring-background transition-transform active:scale-95"
              >
                <Plus className="size-6" aria-hidden />
              </Link>
            </li>
            {primaryNav.slice(2).map((item) => (
              <BottomLink key={item.href} item={item} pathname={pathname} />
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function BottomLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-muted-foreground",
          active && "text-primary-text",
        )}
      >
        <Icon className="size-5" aria-hidden />
        {item.label}
      </Link>
    </li>
  );
}
