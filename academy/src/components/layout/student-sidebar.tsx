import { Logo } from "@/components/ui/logo";
import { getCurrentTenant } from "@/lib/tenant";
import { PromoBox } from "@/components/student/promo-box";
import { NavLink } from "./nav-link";
import { studentNav } from "./nav";

export async function StudentSidebar() {
  const tenant = await getCurrentTenant();
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
      {tenant && <PromoBox promo={tenant.promo} className="mt-auto" />}
    </aside>
  );
}
