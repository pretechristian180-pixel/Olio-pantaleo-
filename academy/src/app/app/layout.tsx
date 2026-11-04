import type { Metadata } from "next";
import { StudentSidebar } from "@/components/layout/student-sidebar";
import { StudentTopbar } from "@/components/layout/student-topbar";
import { TabBar } from "@/components/layout/tab-bar";

export const metadata: Metadata = { title: "La tua area", robots: { index: false, follow: false } };

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-surface-alt">
      <StudentSidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-8 px-4 pt-5 pb-28 sm:px-6 md:pb-12 lg:px-12 lg:pt-8">
        <StudentTopbar />
        <main id="contenuto" className="flex-1">
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
