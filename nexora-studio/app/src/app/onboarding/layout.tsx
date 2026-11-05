import { LogOut } from "lucide-react";

import { NexoraLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

import { signOut } from "../(auth)/actions";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-aurora" aria-hidden />
      <header className="relative mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-5">
        <NexoraLogo />
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit">
            <LogOut aria-hidden /> Esci
          </Button>
        </form>
      </header>
      <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-4 pb-16 sm:pt-8">
        {children}
      </main>
    </div>
  );
}
