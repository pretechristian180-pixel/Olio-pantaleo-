import { displayName, requireUser } from "@/lib/auth";
import { initials } from "@/components/ui/avatar";
import { StudentSidebar } from "@/components/layout/student-sidebar";
import { StudentTopbar } from "@/components/layout/student-topbar";
import { TabBar } from "@/components/layout/tab-bar";

export default async function StudentShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nome = user.profile
    ? `${user.profile.nome} ${user.profile.cognome}`.trim()
    : displayName(user);
  return (
    <div className="flex min-h-dvh bg-surface-alt">
      <StudentSidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-8 px-4 pt-5 pb-28 sm:px-6 md:pb-12 lg:px-12 lg:pt-8">
        <StudentTopbar
          initials={initials(user.profile?.nome, user.profile?.cognome)}
          name={nome || undefined}
        />
        <main id="contenuto" className="flex-1">
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
