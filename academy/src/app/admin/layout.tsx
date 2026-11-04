import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { AdminMobileNav, AdminSidebar } from "@/components/layout/admin-sidebar";

export const metadata: Metadata = {
  title: { default: "Amministrazione", template: "%s · Admin Nexora Academy" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return (
    <div className="flex min-h-dvh bg-surface-alt">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav />
        <main id="contenuto" className="flex-1 px-4 py-6 sm:px-6 lg:px-12 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
