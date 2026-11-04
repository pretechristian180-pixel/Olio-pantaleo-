import { NavLink } from "./nav-link";
import { studentTabs } from "./nav";

/** Sotto i 768px sostituisce la sidebar. */
export function TabBar() {
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-safe md:hidden"
    >
      <div className="flex">
        {studentTabs.map((item) => (
          <NavLink
            key={item.href}
            item={{ href: item.href, label: item.label, exact: item.exact }}
            icon={<item.icon />}
            variant="tab"
          />
        ))}
      </div>
    </nav>
  );
}
