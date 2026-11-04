import type { Metadata } from "next";
import { StudentSidebar } from "@/components/layout/student-sidebar";
import { StudentTopbar } from "@/components/layout/student-topbar";
import { TabBar } from "@/components/layout/tab-bar";

export const metadata: Metadata = { title: "La tua area", robots: { index: false, follow: false } };

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <StudentSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <StudentTopbar />
        <main id="contenuto" className="flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-12 lg:px-10 lg:pt-10">
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
