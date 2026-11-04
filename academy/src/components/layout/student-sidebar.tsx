import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Eyebrow } from "@/components/ui/eyebrow";
import { publicEnv } from "@/lib/env";
import { NavLink } from "./nav-link";
import { studentNav } from "./nav";

export function StudentSidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 flex-col gap-8 bg-graphite-deep px-5 py-8 md:flex">
      <div className="px-3">
        <Logo tone="dark" href="/app" />
      </div>
      <nav aria-label="Menu principale" className="flex flex-col gap-1">
        {studentNav.map((item) => (
          <NavLink
            key={item.href}
            item={{ href: item.href, label: item.label, exact: item.exact }}
            icon={<item.icon />}
            variant="dark"
          />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2.5 rounded-lg bg-graphite p-4">
        <Eyebrow tone="bright" className="text-[11px]">
          Check digitale
        </Eyebrow>
        <p className="text-sm leading-5 text-white">
          Vuoi applicare il corso alla tua azienda? Prenota il Check Digitale Nexora.
        </p>
        {publicEnv.NEXT_PUBLIC_BOOKING_URL && (
          <Link
            href={publicEnv.NEXT_PUBLIC_BOOKING_URL}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-white text-[13px] font-bold text-ink hover:bg-blue-tint"
          >
            Prenota gratis
          </Link>
        )}
      </div>
    </aside>
  );
}
