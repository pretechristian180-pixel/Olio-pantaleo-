import Link from "next/link";

import { NexoraLogo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-aurora" aria-hidden />
      <header className="relative mx-auto flex h-16 w-full max-w-md items-center px-5">
        <Link href="/" aria-label="Christian Prete Studio, torna alla pagina iniziale">
          <NexoraLogo />
        </Link>
      </header>
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-6 pb-12 sm:pt-12">
        {children}
      </main>
    </div>
  );
}
