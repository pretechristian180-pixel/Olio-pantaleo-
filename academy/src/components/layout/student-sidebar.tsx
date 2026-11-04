import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { publicEnv } from "@/lib/env";
import { NavLink } from "./nav-link";
import { studentNav } from "./nav";

export function StudentSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-graphite-deep px-4 py-6 md:flex">
      <div className="px-3">
        <Logo tone="dark" href="/app" />
      </div>
      <nav aria-label="Area studente" className="mt-10 flex flex-col gap-1">
        {studentNav.map((item) => (
          <NavLink
            key={item.href}
            item={{ href: item.href, label: item.label, exact: item.exact }}
            icon={<item.icon />}
            variant="dark"
          />
        ))}
      </nav>
      <div className="mt-auto rounded-lg bg-graphite p-4">
        <CalendarCheck aria-hidden className="size-5 text-nexora-blue-bright" />
        <p className="mt-3 text-sm font-semibold text-white">Prenota il Check Digitale Nexora</p>
        <p className="mt-1 text-xs leading-relaxed text-white/70">
          30 minuti per capire cosa sistemare prima nella tua azienda.
        </p>
        {publicEnv.NEXT_PUBLIC_BOOKING_URL && (
          <Link
            href={publicEnv.NEXT_PUBLIC_BOOKING_URL}
            className="mt-3 inline-flex h-11 items-center text-sm font-semibold text-nexora-blue-bright hover:text-white"
          >
            Prenota ora
          </Link>
        )}
      </div>
    </aside>
  );
}
