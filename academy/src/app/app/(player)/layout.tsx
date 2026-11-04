import { TabBar } from "@/components/layout/tab-bar";

/** Player a tutta pagina (mockup Lezione); su telefono resta la tab bar in basso. */
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface pb-20 md:pb-0">
      {children}
      <TabBar />
    </div>
  );
}
